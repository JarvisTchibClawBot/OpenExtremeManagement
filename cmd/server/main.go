package main

import (
	"log"
	"os"

	"github.com/JarvisTchibClawBot/OpenExtremeManagement/internal/api"
	"github.com/JarvisTchibClawBot/OpenExtremeManagement/internal/config"
	"github.com/joho/godotenv"
)

var (
	Version   = "dev"
	BuildDate = "unknown"
)

func main() {
	// Load .env file if exists
	godotenv.Load()

	// Load configuration
	cfg := config.Load()

	// Initialize and start API server
	server := api.NewServer(cfg)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 OpenExtremeManagement %s (built %s) starting on port %s", Version, BuildDate, port)
	if err := server.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
