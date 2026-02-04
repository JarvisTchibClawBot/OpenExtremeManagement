package main

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// AuthRequest represents the authentication request
type AuthRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	TTL      int    `json:"ttl"`
}

// AuthResponse represents the authentication response (Fabric Engine style)
type AuthResponse struct {
	Token string `json:"token"`
	TTL   int    `json:"ttl"`
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

	// OpenAPI auth endpoint (Fabric Engine style)
	router.POST("/rest/openapi/auth/token", handleAuth)

	log.Printf("🔌 Extreme Networks Fabric Engine Mock - Port 9443")
	log.Printf("🔗 POST /rest/openapi/auth/token")
	log.Printf("📋 Accepts any username/password")

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

	// Default TTL if not provided
	ttl := req.TTL
	if ttl <= 0 {
		ttl = 3600
	}

	// Always return a token (accepts any credentials)
	token := generateToken()

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		TTL:   ttl,
	})
}
