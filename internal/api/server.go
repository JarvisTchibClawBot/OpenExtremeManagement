package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/JarvisTchibClawBot/OpenExtremeManagement/internal/config"
	"github.com/gin-gonic/gin"
)

// Switch represents a managed switch
type Switch struct {
	ID          int          `json:"id"`
	Name        string       `json:"name"`
	IPAddress   string       `json:"ip_address"`
	Port        int          `json:"port"`
	Username    string       `json:"username"`
	Password    string       `json:"-"`
	Status      string       `json:"status"`
	LastSync    *time.Time   `json:"last_sync,omitempty"`
	SystemInfo  *SystemInfo  `json:"system_info,omitempty"`
	AuthToken   string       `json:"-"`
	TokenExpiry time.Time    `json:"-"`
}

// SystemInfo from Fabric Engine
type SystemInfo struct {
	SysName        string `json:"sysName"`
	SysDescription string `json:"sysDescription"`
	ModelName      string `json:"modelName"`
	FirmwareVersion string `json:"firmwareVersion"`
	NosType        string `json:"nosType"`
	ChassisId      string `json:"chassisId"`
	NumPorts       int    `json:"numPorts"`
	IsDigitalTwin  bool   `json:"isDigitalTwin"`
}

type Server struct {
	router   *gin.Engine
	config   *config.Config
	switches map[int]*Switch
	mu       sync.RWMutex
	nextID   int
	stopSync chan struct{}
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
		router:   router,
		config:   cfg,
		switches: make(map[int]*Switch),
		nextID:   1,
		stopSync: make(chan struct{}),
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
			protected.DELETE("/switches/:id", s.deleteSwitch)
			protected.POST("/switches/:id/sync", s.syncSwitchEndpoint)
		}
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
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

type CreateSwitchRequest struct {
	IPAddress string `json:"ip_address" binding:"required"`
	Port      int    `json:"port" binding:"required"`
	Username  string `json:"username" binding:"required"`
	Password  string `json:"password" binding:"required"`
}

func (s *Server) createSwitch(c *gin.Context) {
	var req CreateSwitchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	s.mu.Lock()
	sw := &Switch{
		ID:        s.nextID,
		Name:      fmt.Sprintf("%s:%d", req.IPAddress, req.Port), // Temporary name until sync
		IPAddress: req.IPAddress,
		Port:      req.Port,
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
	url := fmt.Sprintf("http://%s:%d/rest/openapi/auth/token", sw.IPAddress, sw.Port)

	authReq := map[string]interface{}{
		"username": sw.Username,
		"password": sw.Password,
		"ttl":      3600,
	}

	body, _ := json.Marshal(authReq)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
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
	url := fmt.Sprintf("http://%s:%d/rest/openapi/v0/state/system", sw.IPAddress, sw.Port)

	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("X-Auth-Token", sw.AuthToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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
