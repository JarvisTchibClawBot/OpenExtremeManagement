package main

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Token storage
var (
	tokenStore = make(map[string]time.Time)
	tokenMu    sync.RWMutex
)

// AuthRequest represents the authentication request
type AuthRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	TTL      int    `json:"ttl"`
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	Token string `json:"token"`
	TTL   int    `json:"ttl"`
}

// SystemState represents the system state response
type SystemState struct {
	BootConfigType       string `json:"bootConfigType"`
	Cards                []Card `json:"cards"`
	ChassisId            string `json:"chassisId"`
	ChassisIdSubtype     string `json:"chassisIdSubtype"`
	InletsVersion        string `json:"inletsVersion"`
	IqAgentVersion       string `json:"iqAgentVersion"`
	IsConfigDirty        bool   `json:"isConfigDirty"`
	IsDigitalTwin        bool   `json:"isDigitalTwin"`
	NosType              string `json:"nosType"`
	NumSlots             int    `json:"numSlots"`
	OpenApiAppVersion    string `json:"openApiAppVersion"`
	OpenApiSchemaVersion string `json:"openApiSchemaVersion"`
	RebootCount          int    `json:"rebootCount"`
	SysDescription       string `json:"sysDescription"`
	SysName              string `json:"sysName"`
	TelegrafVersion      string `json:"telegrafVersion"`
}

// Card represents a card in the switch
type Card struct {
	AdminStatus     string   `json:"adminStatus"`
	BaseMacAddress  string   `json:"baseMacAddress"`
	BrandName       string   `json:"brandName"`
	FirmwareVersion string   `json:"firmwareVersion"`
	HardwareRev     string   `json:"hardwareRev"`
	IsPowerEnabled  bool     `json:"isPowerEnabled"`
	MacAddrCapacity int      `json:"macAddrCapacity"`
	ModelName       string   `json:"modelName"`
	NumPorts        int      `json:"numPorts"`
	OperationStatus string   `json:"operationStatus"`
	PartNumber      string   `json:"partNumber"`
	SerialNumber    string   `json:"serialNumber"`
	SlotNumber      int      `json:"slotNumber"`
	SysBuildTime    string   `json:"sysBuildTime"`
	SysUpTime       int      `json:"sysUpTime"`
	Vims            []string `json:"vims"`
}

func main() {
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// CORS middleware
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-Token")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Auth endpoint
	router.POST("/rest/openapi/auth/token", handleAuth)

	// Protected endpoints
	protected := router.Group("/rest/openapi")
	protected.Use(authMiddleware())
	{
		protected.GET("/v0/state/system", getSystemState)
	}

	log.Printf("🔌 Extreme Networks Fabric Engine Mock - Port 9443")
	log.Printf("🔗 POST /rest/openapi/auth/token")
	log.Printf("🔗 GET  /rest/openapi/v0/state/system (requires X-Auth-Token)")

	if err := router.Run(":9443"); err != nil {
		log.Fatalf("Failed to start mock server: %v", err)
	}
}

func generateToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func handleAuth(c *gin.Context) {
	var req AuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	ttl := req.TTL
	if ttl <= 0 {
		ttl = 3600
	}

	// Generate and store token
	token := generateToken()
	expiration := time.Now().Add(time.Duration(ttl) * time.Second)

	tokenMu.Lock()
	tokenStore[token] = expiration
	tokenMu.Unlock()

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		TTL:   ttl,
	})
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-Auth-Token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing X-Auth-Token header"})
			c.Abort()
			return
		}

		tokenMu.RLock()
		expiration, exists := tokenStore[token]
		tokenMu.RUnlock()

		if !exists || time.Now().After(expiration) {
			tokenMu.Lock()
			delete(tokenStore, token)
			tokenMu.Unlock()
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func getSystemState(c *gin.Context) {
	state := SystemState{
		BootConfigType: "FACTORY_DEFAULT",
		Cards: []Card{
			{
				AdminStatus:     "UP",
				BaseMacAddress:  "0c:fa:b2:98:00:00",
				BrandName:       "Extreme Networks.",
				FirmwareVersion: "9.3.0.0",
				HardwareRev:     "1",
				IsPowerEnabled:  true,
				MacAddrCapacity: 1024,
				ModelName:       "5520-24T-FabricEngine",
				NumPorts:        27,
				OperationStatus: "UP",
				PartNumber:      "DSGDPM624",
				SerialNumber:    "SIMB298-0000",
				SlotNumber:      1,
				SysBuildTime:    "Tue/Sep/9/14:14:20/EDT/2025",
				SysUpTime:       915500,
				Vims:            []string{},
			},
		},
		ChassisId:            "0cfab2980000",
		ChassisIdSubtype:     "MAC_ADDRESS",
		InletsVersion:        "N/A",
		IqAgentVersion:       "0.9.22",
		IsConfigDirty:        true,
		IsDigitalTwin:        true,
		NosType:              "FABRIC_ENGINE",
		NumSlots:             2,
		OpenApiAppVersion:    "0.1.10.10",
		OpenApiSchemaVersion: "0.2.0",
		RebootCount:          0,
		SysDescription:       "5520-24T-FabricEngine (9.3.0.0)",
		SysName:              "5520-24T-FabricEngine",
		TelegrafVersion:      "1.21.4-58592c4a",
	}

	c.JSON(http.StatusOK, state)
}
