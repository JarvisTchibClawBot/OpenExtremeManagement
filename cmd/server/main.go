package main

import (
	"log"
	"os"

	"github.com/JarvisTchibClawBot/OpenExtremeManagement/internal/api"
	"github.com/JarvisTchibClawBot/OpenExtremeManagement/internal/config"
	"github.com/joho/godotenv"
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

	log.Printf("🚀 OpenExtremeManagement starting on port %s", port)
	if err := server.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
