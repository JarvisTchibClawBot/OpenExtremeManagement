.PHONY: run build test clean docker-build docker-up docker-down

# Development
run:
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

test:
	go test -v ./...

clean:
	rm -rf bin/

# Docker
docker-build:
	docker build -t openextrememanagement:latest .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Dependencies
deps:
	go mod download
	go mod tidy
