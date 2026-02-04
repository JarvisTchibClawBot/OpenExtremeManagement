package api

import (
	"net/http"

	"github.com/JarvisTchibClawBot/OpenExtremeManagement/internal/config"
	"github.com/gin-gonic/gin"
)

type Server struct {
	router *gin.Engine
	config *config.Config
}

func NewServer(cfg *config.Config) *Server {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()
	server := &Server{
		router: router,
		config: cfg,
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
		// Switches
		v1.GET("/switches", s.listSwitches)
		v1.GET("/switches/:id", s.getSwitch)
		v1.POST("/switches", s.createSwitch)
		v1.PUT("/switches/:id", s.updateSwitch)
		v1.DELETE("/switches/:id", s.deleteSwitch)

		// Switch operations
		v1.GET("/switches/:id/ports", s.getSwitchPorts)
		v1.GET("/switches/:id/config", s.getSwitchConfig)
		v1.POST("/switches/:id/backup", s.backupSwitchConfig)
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

// Placeholder handlers - to be implemented
func (s *Server) listSwitches(c *gin.Context)      { c.JSON(http.StatusOK, gin.H{"switches": []any{}}) }
func (s *Server) getSwitch(c *gin.Context)         { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func (s *Server) createSwitch(c *gin.Context)      { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func (s *Server) updateSwitch(c *gin.Context)      { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func (s *Server) deleteSwitch(c *gin.Context)      { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func (s *Server) getSwitchPorts(c *gin.Context)    { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func (s *Server) getSwitchConfig(c *gin.Context)   { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
func (s *Server) backupSwitchConfig(c *gin.Context) { c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"}) }
