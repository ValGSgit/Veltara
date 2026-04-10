.PHONY: help install dev build test lint typecheck clean \
	docker-up docker-up-attach docker-down docker-clean docker-logs \
        certs-setup certs-setup-win \
        deploy-workers deploy-portal

# Default target
help:
	@echo "Veltara Makefile - Run commands with: make <target>"
	@echo ""
	@echo "Development:"
	@echo "  make install        - Install dependencies"
	@echo "  make dev            - Start dev server (web + workers + portal)"
	@echo "  make build          - Build all packages"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make test           - Run tests"
	@echo "  make lint           - Lint all packages"
	@echo "  make typecheck      - Type check all packages"
	@echo "  make clean          - Clean build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up      - Start Docker containers in detached mode"
	@echo "  make docker-up-attach - Start Docker containers and attach logs"
	@echo "  make docker-down    - Stop Docker containers"
	@echo "  make docker-clean   - Stop and remove volumes"
	@echo "  make docker-logs    - Follow Docker logs"
	@echo ""
	@echo "Certificates:"
	@echo "  make certs-setup    - Setup local HTTPS certs (Linux/macOS/WSL)"
	@echo "  make certs-setup-win - Setup local HTTPS certs (Windows PowerShell)"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-workers - Deploy Workers"
	@echo "  make deploy-portal  - Deploy Portal to Cloudflare Pages"
	@echo ""

# Installation & Setup
install:
	pnpm install

# Development
dev:
	pnpm dev

build:
	pnpm build

# Testing & Quality
test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

clean:
	pnpm clean

# Docker
docker-up:
	docker compose up --build -d

docker-up-attach:
	docker compose up --build

docker-down:
	docker compose down

docker-clean:
	docker compose down -v

docker-logs:
	docker compose logs -f

# Certificates
certs-setup:
	pnpm certs:setup

certs-setup-win:
	pnpm certs:setup:win

# Deployment
deploy-workers:
	pnpm --filter @veltara/workers deploy

deploy-portal:
	pnpm --filter @veltara/portal build

# Convenience aliases
i: install
d: dev
b: build
t: test
l: lint
tc: typecheck
c: clean
up: docker-up
down: docker-down
logs: docker-logs
