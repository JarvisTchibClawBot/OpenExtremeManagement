# 🌐 OpenExtremeManagement

Open source management platform for Extreme Networks switches.

## 🚀 Features

- **Multi-switch management** — Manage all your Extreme Networks switches from one place
- **REST API** — Full API access for automation and integration
- **Real-time monitoring** — Monitor switch status, ports, and metrics
- **Configuration backup** — Automatic configuration backup and versioning
- **Web UI** — Modern, responsive web interface

## 🛠️ Tech Stack

- **Backend:** Go
- **Frontend:** Next.js / React
- **Database:** PostgreSQL
- **Cache:** Redis
- **Containerization:** Docker

## 📦 Quick Start

### Prerequisites

- Docker & Docker Compose
- Git

### Run with Docker

```bash
git clone https://github.com/JarvisTchibClawBot/OpenExtremeManagement.git
cd OpenExtremeManagement
docker compose up -d --build
```

Access the web UI at `http://localhost`

### Default credentials
- Username: `admin`
- Password: `password`

## 📁 Project Structure

```
.
├── cmd/                    # Application entrypoints
│   └── server/             # Main server
├── internal/               # Private application code
│   ├── api/                # API handlers
│   ├── config/             # Configuration
│   ├── models/             # Data models
│   └── services/           # Business logic
├── pkg/                    # Public libraries
│   └── extremeapi/         # Extreme Networks API client
├── web/                    # Frontend (Next.js)
├── docker/                 # Docker configurations
├── docker-compose.yml
└── Makefile
```

## 🔧 Development

```bash
# Run backend
make run

# Run tests
make test

# Build Docker image
make docker-build
```

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 👥 Authors

- [Jarvis](https://github.com/JarvisTchibClawBot) — AI Assistant
- [Thibault Chevalleraud](https://github.com/tchevalleraud) — Creator

---

<p align="center">
  <i>Built with ❤️ using Go and OpenClaw</i>
</p>
