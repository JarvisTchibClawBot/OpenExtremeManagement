package api

import (
	"net/http"
	"sync"

	"github.com/JarvisTchibClawBot/OpenExtremeManagement/internal/config"
	"github.com/gin-gonic/gin"
)

type Switch struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	IPAddress string `json:"ip_address"`
	Model     string `json:"model"`
	Status    string `json:"status"`
	LastSeen  string `json:"last_seen"`
	APIKey    string `json:"-"`
}

type Server struct {
	router   *gin.Engine
	config   *config.Config
	switches []Switch
	mu       sync.RWMutex
	nextID   int
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
		switches: []Switch{},
		nextID:   1,
	}

	server.setupRoutes()
	return server
}

func (s *Server) setupRoutes() {
	// Health check
	s.router.GET("/health", s.healthCheck)

	// API v1
	v1 := s.router.Group("/api/v1")
	{
		// Auth routes (public)
		v1.POST("/auth/login", s.login)

		// Protected routes
		protected := v1.Group("")
		protected.Use(s.authMiddleware())
		{
			// Switches
			protected.GET("/switches", s.listSwitches)
			protected.GET("/switches/:id", s.getSwitch)
			protected.POST("/switches", s.createSwitch)
			protected.PUT("/switches/:id", s.updateSwitch)
			protected.DELETE("/switches/:id", s.deleteSwitch)

			// Switch operations
			protected.GET("/switches/:id/ports", s.getSwitchPorts)
			protected.GET("/switches/:id/config", s.getSwitchConfig)
			protected.POST("/switches/:id/backup", s.backupSwitchConfig)
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
	c.JSON(http.StatusOK, gin.H{"switches": s.switches})
}

func (s *Server) getSwitch(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

type CreateSwitchRequest struct {
	Name      string `json:"name" binding:"required"`
	IPAddress string `json:"ip_address" binding:"required"`
	APIKey    string `json:"api_key" binding:"required"`
}

func (s *Server) createSwitch(c *gin.Context) {
	var req CreateSwitchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	sw := Switch{
		ID:        s.nextID,
		Name:      req.Name,
		IPAddress: req.IPAddress,
		APIKey:    req.APIKey,
		Status:    "unknown",
		Model:     "Detecting...",
	}
	s.nextID++
	s.switches = append(s.switches, sw)

	c.JSON(http.StatusCreated, gin.H{"switch": sw})
}

func (s *Server) updateSwitch(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

func (s *Server) deleteSwitch(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

func (s *Server) getSwitchPorts(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

func (s *Server) getSwitchConfig(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

func (s *Server) backupSwitchConfig(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}
