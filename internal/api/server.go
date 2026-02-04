package api

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/JarvisTchibClawBot/OpenExtremeManagement/internal/config"
	"github.com/gin-gonic/gin"
)

// HTTP client with TLS skip verify for self-signed certs
var insecureClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	},
}

// Switch represents a managed switch
type Switch struct {
	ID              int          `json:"id"`
	Name            string       `json:"name"`
	IPAddress       string       `json:"ip_address"`
	Port            int          `json:"port"`
	UseHTTPS        bool         `json:"use_https"`
	Username        string       `json:"username"`
	Password        string       `json:"-"`
	Status          string       `json:"status"`
	LastSync        *time.Time   `json:"last_sync,omitempty"`
	SystemInfo      *SystemInfo  `json:"system_info,omitempty"`
	AuthToken       string       `json:"-"`
	TokenExpiry     time.Time    `json:"-"`
	OpenAPISchema   string       `json:"openapi_schema,omitempty"`
	SchemaFetchedAt *time.Time   `json:"schema_fetched_at,omitempty"`
}

// SystemInfo from Fabric Engine
type SystemInfo struct {
	SysName         string `json:"sysName"`
	SysDescription  string `json:"sysDescription"`
	SysLocation     string `json:"sysLocation"`
	SysContact      string `json:"sysContact"`
	ModelName       string `json:"modelName"`
	FirmwareVersion string `json:"firmwareVersion"`
	NosType         string `json:"nosType"`
	ChassisId       string `json:"chassisId"`
	NumPorts        int    `json:"numPorts"`
	IsDigitalTwin   bool   `json:"isDigitalTwin"`
}

type Server struct {
	router       *gin.Engine
	config       *config.Config
	switches     map[int]*Switch
	uploadTokens map[string]int // token -> switchID mapping
	mu           sync.RWMutex
	nextID       int
	stopSync     chan struct{}
}

func NewServer(cfg *config.Config) *Server {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// CORS middleware
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	server := &Server{
		router:       router,
		config:       cfg,
		switches:     make(map[int]*Switch),
		uploadTokens: make(map[string]int),
		nextID:       1,
		stopSync:     make(chan struct{}),
	}

	server.setupRoutes()
	
	// Start background sync
	go server.syncLoop()

	return server
}

func (s *Server) setupRoutes() {
	s.router.GET("/health", s.healthCheck)

	v1 := s.router.Group("/api/v1")
	{
		v1.POST("/auth/login", s.login)

		protected := v1.Group("")
		protected.Use(s.authMiddleware())
		{
			protected.GET("/switches", s.listSwitches)
			protected.GET("/switches/:id", s.getSwitch)
			protected.POST("/switches", s.createSwitch)
			protected.PUT("/switches/:id", s.updateSwitch)
			protected.DELETE("/switches/:id", s.deleteSwitch)
			protected.POST("/switches/:id/sync", s.syncSwitchEndpoint)
			protected.GET("/switches/:id/ports", s.getPorts)
			protected.PUT("/switches/:id/system", s.updateSystemInfo)
			protected.POST("/switches/:id/fetch-schema", s.fetchSchema)
			protected.GET("/switches/:id/schema", s.downloadSchema)
		}

		// Public upload endpoint (no auth required as it's called by the switch)
		v1.POST("/upload/schema/:token", s.uploadSchema)
	}
}

func (s *Server) Run(addr string) error {
	return s.router.Run(addr)
}

func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "OpenExtremeManagement",
	})
}

func (s *Server) listSwitches(c *gin.Context) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	switches := make([]*Switch, 0, len(s.switches))
	for _, sw := range s.switches {
		switches = append(switches, sw)
	}

	c.JSON(http.StatusOK, gin.H{"switches": switches})
}

func (s *Server) getSwitch(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid switch ID"})
		return
	}

	s.mu.RLock()
	sw, exists := s.switches[id]
	s.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Switch not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"switch": sw})
}

type CreateSwitchRequest struct {
	IPAddress string `json:"ip_address" binding:"required"`
	Port      int    `json:"port" binding:"required"`
	UseHTTPS  *bool  `json:"use_https"` // Pointer to detect if provided, defaults to true
	Username  string `json:"username" binding:"required"`
	Password  string `json:"password" binding:"required"`
}

func (s *Server) createSwitch(c *gin.Context) {
	var req CreateSwitchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Default to HTTPS if not specified
	useHTTPS := true
	if req.UseHTTPS != nil {
		useHTTPS = *req.UseHTTPS
	}

	s.mu.Lock()
	sw := &Switch{
		ID:        s.nextID,
		Name:      fmt.Sprintf("%s:%d", req.IPAddress, req.Port), // Temporary name until sync
		IPAddress: req.IPAddress,
		Port:      req.Port,
		UseHTTPS:  useHTTPS,
		Username:  req.Username,
		Password:  req.Password,
		Status:    "connecting",
	}
	s.switches[s.nextID] = sw
	s.nextID++
	s.mu.Unlock()

	// Trigger immediate sync for this switch
	go s.syncSwitch(sw)

	c.JSON(http.StatusCreated, gin.H{"switch": sw})
}

func (s *Server) deleteSwitch(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid switch ID"})
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.switches[id]; !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Switch not found"})
		return
	}

	delete(s.switches, id)
	c.JSON(http.StatusOK, gin.H{"message": "Switch deleted"})
}

type UpdateSwitchRequest struct {
	IPAddress string `json:"ip_address"`
	Port      int    `json:"port"`
	UseHTTPS  *bool  `json:"use_https"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

func (s *Server) updateSwitch(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid switch ID"})
		return
	}

	var req UpdateSwitchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	s.mu.Lock()
	sw, exists := s.switches[id]
	if !exists {
		s.mu.Unlock()
		c.JSON(http.StatusNotFound, gin.H{"error": "Switch not found"})
		return
	}

	// Update fields
	if req.IPAddress != "" {
		sw.IPAddress = req.IPAddress
	}
	if req.Port != 0 {
		sw.Port = req.Port
	}
	if req.UseHTTPS != nil {
		sw.UseHTTPS = *req.UseHTTPS
	}
	if req.Username != "" {
		sw.Username = req.Username
	}
	if req.Password != "" {
		sw.Password = req.Password
		// Reset auth token to force re-authentication
		sw.AuthToken = ""
		sw.TokenExpiry = time.Time{}
	}

	// Update name temporarily
	sw.Name = fmt.Sprintf("%s:%d", sw.IPAddress, sw.Port)
	sw.Status = "connecting"
	s.mu.Unlock()

	// Trigger re-sync
	go s.syncSwitch(sw)

	c.JSON(http.StatusOK, gin.H{"switch": sw})
}

func (s *Server) syncSwitchEndpoint(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid switch ID"})
		return
	}

	s.mu.RLock()
	sw, exists := s.switches[id]
	s.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Switch not found"})
		return
	}

	// Trigger sync in background
	go s.syncSwitch(sw)

	c.JSON(http.StatusOK, gin.H{"message": "Sync triggered"})
}

// Port represents a switch port
type Port struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"` // up, down, disabled
	Speed  string `json:"speed"`
}

func (s *Server) getPorts(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid switch ID"})
		return
	}

	s.mu.RLock()
	sw, exists := s.switches[id]
	s.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Switch not found"})
		return
	}

	// Generate mock ports based on numPorts
	numPorts := 24
	if sw.SystemInfo != nil {
		numPorts = sw.SystemInfo.NumPorts
	}

	ports := make([]Port, numPorts)
	for i := 0; i < numPorts; i++ {
		status := "up"
		if i%7 == 0 {
			status = "down"
		} else if i%11 == 0 {
			status = "disabled"
		}

		speed := "1G"
		if i%4 == 0 {
			speed = "10G"
		}

		ports[i] = Port{
			ID:     i + 1,
			Name:   fmt.Sprintf("GigabitEthernet 1/0/%d", i+1),
			Status: status,
			Speed:  speed,
		}
	}

	c.JSON(http.StatusOK, gin.H{"ports": ports})
}

type UpdateSystemInfoRequest struct {
	SysName     string `json:"sysName"`
	SysLocation string `json:"sysLocation"`
	SysContact  string `json:"sysContact"`
}

func (s *Server) updateSystemInfo(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid switch ID"})
		return
	}

	var req UpdateSystemInfoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	s.mu.RLock()
	sw, exists := s.switches[id]
	s.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Switch not found"})
		return
	}

	// Authenticate if needed
	if sw.AuthToken == "" || time.Now().After(sw.TokenExpiry) {
		if err := s.authenticateSwitch(sw); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication failed: " + err.Error()})
			return
		}
	}

	// Update system info on the switch
	if err := s.pushSystemInfoToSwitch(sw, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update switch: " + err.Error()})
		return
	}

	// Update local cache
	s.mu.Lock()
	if sw.SystemInfo == nil {
		sw.SystemInfo = &SystemInfo{}
	}
	if req.SysName != "" {
		sw.SystemInfo.SysName = req.SysName
		sw.Name = req.SysName
	}
	sw.SystemInfo.SysLocation = req.SysLocation
	sw.SystemInfo.SysContact = req.SysContact
	s.mu.Unlock()

	log.Printf("✅ Updated system info for %s", sw.Name)
	c.JSON(http.StatusOK, gin.H{"switch": sw})
}

// pushSystemInfoToSwitch sends system info updates to the switch
func (s *Server) pushSystemInfoToSwitch(sw *Switch, req *UpdateSystemInfoRequest) error {
	protocol := "http"
	if sw.UseHTTPS {
		protocol = "https"
	}

	// Extreme Networks switches typically use PATCH for partial updates
	url := fmt.Sprintf("%s://%s:%d/rest/openapi/v0/operation/system", protocol, sw.IPAddress, sw.Port)

	// Build payload with only provided fields
	payload := make(map[string]interface{})
	if req.SysName != "" {
		payload["sysName"] = req.SysName
	}
	if req.SysLocation != "" {
		payload["sysLocation"] = req.SysLocation
	}
	if req.SysContact != "" {
		payload["sysContact"] = req.SysContact
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %v", err)
	}

	httpReq, _ := http.NewRequest("PATCH", url, bytes.NewReader(jsonData))
	httpReq.Header.Set("X-Auth-Token", sw.AuthToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := insecureClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// Background sync loop
func (s *Server) syncLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.syncAllSwitches()
		case <-s.stopSync:
			return
		}
	}
}

func (s *Server) syncAllSwitches() {
	s.mu.RLock()
	switches := make([]*Switch, 0, len(s.switches))
	for _, sw := range s.switches {
		switches = append(switches, sw)
	}
	s.mu.RUnlock()

	for _, sw := range switches {
		s.syncSwitch(sw)
	}
}

func (s *Server) syncSwitch(sw *Switch) {
	log.Printf("🔄 Syncing switch %s (%s:%d)", sw.Name, sw.IPAddress, sw.Port)

	// Authenticate if needed
	if sw.AuthToken == "" || time.Now().After(sw.TokenExpiry) {
		if err := s.authenticateSwitch(sw); err != nil {
			log.Printf("❌ Auth failed for %s: %v", sw.Name, err)
			s.mu.Lock()
			sw.Status = "auth_failed"
			s.mu.Unlock()
			return
		}
	}

	// Fetch system info
	systemInfo, err := s.fetchSystemInfo(sw)
	if err != nil {
		log.Printf("❌ Sync failed for %s: %v", sw.Name, err)
		s.mu.Lock()
		sw.Status = "error"
		s.mu.Unlock()
		return
	}

	// Update switch data
	s.mu.Lock()
	now := time.Now()
	sw.Status = "online"
	sw.LastSync = &now
	sw.SystemInfo = systemInfo
	// Update name from sysName
	if systemInfo.SysName != "" {
		sw.Name = systemInfo.SysName
	}
	s.mu.Unlock()

	log.Printf("✅ Synced %s - %s (%s)", sw.Name, systemInfo.ModelName, systemInfo.FirmwareVersion)
}

func (s *Server) authenticateSwitch(sw *Switch) error {
	protocol := "http"
	if sw.UseHTTPS {
		protocol = "https"
	}
	url := fmt.Sprintf("%s://%s:%d/rest/openapi/auth/token", protocol, sw.IPAddress, sw.Port)

	authReq := map[string]interface{}{
		"username": sw.Username,
		"password": sw.Password,
		"ttl":      3600,
	}

	body, _ := json.Marshal(authReq)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := insecureClient.Do(req)
	if err != nil {
		return fmt.Errorf("connection failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("auth failed: status %d", resp.StatusCode)
	}

	var authResp struct {
		Token string `json:"token"`
		TTL   int    `json:"ttl"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return fmt.Errorf("invalid auth response: %v", err)
	}

	s.mu.Lock()
	sw.AuthToken = authResp.Token
	sw.TokenExpiry = time.Now().Add(time.Duration(authResp.TTL) * time.Second)
	s.mu.Unlock()

	return nil
}

func (s *Server) fetchSystemInfo(sw *Switch) (*SystemInfo, error) {
	protocol := "http"
	if sw.UseHTTPS {
		protocol = "https"
	}
	url := fmt.Sprintf("%s://%s:%d/rest/openapi/v0/state/system", protocol, sw.IPAddress, sw.Port)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("X-Auth-Token", sw.AuthToken)

	resp, err := insecureClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	var state struct {
		SysName        string `json:"sysName"`
		SysDescription string `json:"sysDescription"`
		SysLocation    string `json:"sysLocation"`
		SysContact     string `json:"sysContact"`
		NosType        string `json:"nosType"`
		ChassisId      string `json:"chassisId"`
		IsDigitalTwin  bool   `json:"isDigitalTwin"`
		Cards          []struct {
			ModelName       string `json:"modelName"`
			FirmwareVersion string `json:"firmwareVersion"`
			NumPorts        int    `json:"numPorts"`
		} `json:"cards"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&state); err != nil {
		return nil, fmt.Errorf("invalid response: %v", err)
	}

	info := &SystemInfo{
		SysName:        state.SysName,
		SysDescription: state.SysDescription,
		SysLocation:    state.SysLocation,
		SysContact:     state.SysContact,
		NosType:        state.NosType,
		ChassisId:      state.ChassisId,
		IsDigitalTwin:  state.IsDigitalTwin,
	}

	if len(state.Cards) > 0 {
		info.ModelName = state.Cards[0].ModelName
		info.FirmwareVersion = state.Cards[0].FirmwareVersion
		info.NumPorts = state.Cards[0].NumPorts
	}

	return info, nil
}

// fetchSchema triggers the switch to upload its OpenAPI schema
func (s *Server) fetchSchema(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid switch ID"})
		return
	}

	s.mu.RLock()
	sw, exists := s.switches[id]
	s.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Switch not found"})
		return
	}

	// Generate a unique upload token
	token := fmt.Sprintf("%d-%d", id, time.Now().Unix())
	
	s.mu.Lock()
	s.uploadTokens[token] = id
	s.mu.Unlock()

	// Clean up token after 10 minutes
	go func() {
		time.Sleep(10 * time.Minute)
		s.mu.Lock()
		delete(s.uploadTokens, token)
		s.mu.Unlock()
	}()

	// Prepare the upload request to the switch
	protocol := "http"
	if sw.UseHTTPS {
		protocol = "https"
	}
	
	// Get server's external IP or hostname
	uploadURL := fmt.Sprintf("http://10.201.100.202:9301/api/v1/upload/schema/%s", token)
	
	url := fmt.Sprintf("%s://%s:%d/rest/openapi/v0/operation/system/debug-info/:upload", protocol, sw.IPAddress, sw.Port)
	
	requestBody := map[string]interface{}{
		"URL":      uploadURL,
		"infoType": []string{"OPENAPI_SCHEMA"},
		"username": "upload",     // Placeholder credentials for HTTP upload
		"password": "upload123",
	}

	body, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Auth-Token", sw.AuthToken)

	resp, err := insecureClient.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to request schema: %v", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Switch returned error: %s", string(bodyBytes))})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Schema fetch requested. The switch will upload the schema shortly.",
		"token":   token,
	})
}

// uploadSchema receives the OpenAPI schema file from the switch
func (s *Server) uploadSchema(c *gin.Context) {
	token := c.Param("token")

	s.mu.RLock()
	switchID, exists := s.uploadTokens[token]
	s.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid or expired upload token"})
		return
	}

	// Read the uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		// Try reading from request body instead
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read upload"})
			return
		}

		s.mu.Lock()
		sw := s.switches[switchID]
		if sw != nil {
			sw.OpenAPISchema = string(bodyBytes)
			now := time.Now()
			sw.SchemaFetchedAt = &now
		}
		delete(s.uploadTokens, token)
		s.mu.Unlock()

		log.Printf("✅ Received OpenAPI schema for switch %d (%d bytes)", switchID, len(bodyBytes))
		c.JSON(http.StatusOK, gin.H{"message": "Schema uploaded successfully"})
		return
	}

	// Handle multipart file upload
	openedFile, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer openedFile.Close()

	schemaBytes, err := io.ReadAll(openedFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// Check if it's a gzip file and extract openapi.yaml
	schema := string(schemaBytes)
	if len(schemaBytes) > 2 && schemaBytes[0] == 0x1f && schemaBytes[1] == 0x8b {
		// It's a gzip file, extract it
		extractedSchema, err := extractOpenAPIFromGzip(schemaBytes)
		if err != nil {
			log.Printf("⚠️  Failed to extract gzip: %v, storing as-is", err)
		} else {
			schema = extractedSchema
			log.Printf("✅ Extracted OpenAPI schema from .tar.gz archive")
		}
	}

	s.mu.Lock()
	sw := s.switches[switchID]
	if sw != nil {
		sw.OpenAPISchema = schema
		now := time.Now()
		sw.SchemaFetchedAt = &now
	}
	delete(s.uploadTokens, token)
	s.mu.Unlock()

	log.Printf("✅ Received OpenAPI schema for switch %d (%d bytes)", switchID, len(schema))
	c.JSON(http.StatusOK, gin.H{"message": "Schema uploaded successfully"})
}

// extractOpenAPIFromGzip extracts openapi.yaml from a .tar.gz archive
func extractOpenAPIFromGzip(data []byte) (string, error) {
	// Create gzip reader
	gzReader, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("failed to create gzip reader: %v", err)
	}
	defer gzReader.Close()

	// Create tar reader
	tarReader := tar.NewReader(gzReader)

	// Look for openapi.yaml in the archive
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("failed to read tar: %v", err)
		}

		// Check if this is the openapi.yaml file
		if strings.HasSuffix(header.Name, "openapi.yaml") || strings.HasSuffix(header.Name, "openapi.yml") {
			// Read the file content
			content, err := io.ReadAll(tarReader)
			if err != nil {
				return "", fmt.Errorf("failed to read openapi.yaml: %v", err)
			}
			return string(content), nil
		}
	}

	return "", fmt.Errorf("openapi.yaml not found in archive")
}

// downloadSchema returns the stored OpenAPI schema for download
func (s *Server) downloadSchema(c *gin.Context) {
	idStr := c.Param("id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid switch ID"})
		return
	}

	s.mu.RLock()
	sw, exists := s.switches[id]
	s.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Switch not found"})
		return
	}

	if sw.OpenAPISchema == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "No schema available. Please fetch it first."})
		return
	}

	// Set headers for file download
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=openapi-%s.yaml", sw.Name))
	c.Header("Content-Type", "application/x-yaml")
	c.String(http.StatusOK, sw.OpenAPISchema)
}
