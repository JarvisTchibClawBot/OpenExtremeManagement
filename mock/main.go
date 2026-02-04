package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// AuthRequest represents the authentication request
type AuthRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	TTL      int    `json:"ttl"` // Time to live in seconds
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	Token string `json:"token"`
	TTL   int    `json:"ttl"`
}

// TokenStore stores valid tokens with their expiration
var tokenStore = make(map[string]time.Time)

// Default credentials for the mock switch
const (
	defaultUsername = "admin"
	defaultPassword = "password"
	defaultTTL      = 3600 // 1 hour
)

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

	// OpenAPI routes
	rest := router.Group("/rest/openapi")
	{
		// Authentication
		rest.POST("/auth/token", handleAuth)
		rest.DELETE("/auth/token", handleLogout)

		// Protected routes
		protected := rest.Group("")
		protected.Use(authMiddleware())
		{
			// System info
			protected.GET("/system", getSystemInfo)
			protected.GET("/system/info", getSystemInfo)

			// Ports
			protected.GET("/ports", getPorts)
			protected.GET("/ports/:port", getPort)

			// VLANs
			protected.GET("/vlan", getVLANs)
			protected.GET("/vlan/:id", getVLAN)

			// Configuration
			protected.GET("/config/running", getRunningConfig)
		}
	}

	log.Printf("🔌 Extreme Networks Mock Switch starting on port 9443")
	log.Printf("📋 Credentials: %s / %s", defaultUsername, defaultPassword)
	log.Printf("🔗 Auth endpoint: POST /rest/openapi/auth/token")
	
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Validate credentials
	if req.Username != defaultUsername || req.Password != defaultPassword {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Set TTL (default if not provided)
	ttl := req.TTL
	if ttl <= 0 {
		ttl = defaultTTL
	}

	// Generate token
	token := generateToken()
	expiration := time.Now().Add(time.Duration(ttl) * time.Second)
	tokenStore[token] = expiration

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		TTL:   ttl,
	})
}

func handleLogout(c *gin.Context) {
	token := c.GetHeader("X-Auth-Token")
	if token != "" {
		delete(tokenStore, token)
	}
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-Auth-Token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No authentication token provided"})
			c.Abort()
			return
		}

		expiration, exists := tokenStore[token]
		if !exists || time.Now().After(expiration) {
			delete(tokenStore, token)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func getSystemInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"systemName":    "Mock-VSP-4450GTX",
		"systemModel":   "VSP-4450GTX-PWR+",
		"systemVersion": "9.3.0.0",
		"systemUptime":  "5 days, 12:34:56",
		"systemSerial":  "MOCK123456789",
		"systemMac":     "00:51:00:AA:BB:CC",
		"chassisType":   "VSP-4450GTX-PWR+",
		"firmware": gin.H{
			"version": "9.3.0.0",
			"build":   "GA",
		},
	})
}

func getPorts(c *gin.Context) {
	ports := []gin.H{}
	
	// Generate 48 mock ports
	for i := 1; i <= 48; i++ {
		status := "up"
		if i%7 == 0 {
			status = "down"
		}
		
		ports = append(ports, gin.H{
			"portId":      i,
			"portName":    fmt.Sprintf("1/%d", i),
			"adminStatus": "enabled",
			"operStatus":  status,
			"speed":       "1000",
			"duplex":      "full",
			"vlan":        1,
			"description": fmt.Sprintf("Port %d", i),
		})
	}

	c.JSON(http.StatusOK, gin.H{"ports": ports})
}

func getPort(c *gin.Context) {
	portId := c.Param("port")
	c.JSON(http.StatusOK, gin.H{
		"portId":      portId,
		"portName":    fmt.Sprintf("1/%s", portId),
		"adminStatus": "enabled",
		"operStatus":  "up",
		"speed":       "1000",
		"duplex":      "full",
		"vlan":        1,
		"statistics": gin.H{
			"rxBytes":   123456789,
			"txBytes":   987654321,
			"rxPackets": 1234567,
			"txPackets": 7654321,
			"rxErrors":  0,
			"txErrors":  0,
		},
	})
}

func getVLANs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"vlans": []gin.H{
			{"id": 1, "name": "Default", "ports": "1/1-1/48"},
			{"id": 10, "name": "Management", "ports": "1/1-1/4"},
			{"id": 20, "name": "Servers", "ports": "1/5-1/12"},
			{"id": 30, "name": "Users", "ports": "1/13-1/40"},
			{"id": 100, "name": "Guest", "ports": "1/41-1/48"},
		},
	})
}

func getVLAN(c *gin.Context) {
	vlanId := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"id":    vlanId,
		"name":  fmt.Sprintf("VLAN-%s", vlanId),
		"ports": "1/1-1/48",
	})
}

func getRunningConfig(c *gin.Context) {
	config := `!
! Extreme Networks Virtual Services Platform
! Software Version: 9.3.0.0
!
hostname Mock-VSP-4450GTX
!
interface GigabitEthernet 1/1
  description "Uplink"
  no shutdown
!
interface GigabitEthernet 1/2
  description "Server 1"
  no shutdown
!
vlan 1 name "Default"
vlan 10 name "Management"
vlan 20 name "Servers"
vlan 30 name "Users"
vlan 100 name "Guest"
!
end
`
	c.JSON(http.StatusOK, gin.H{"config": config})
}
