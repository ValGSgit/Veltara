# Veltara

Veltara is a full-stack social platform centered around a shared Three.js planet, real-time region multiplayer, AI-powered world features, and a developer API + SDK ecosystem.

## Monorepo Layout

- apps/web: main immersive app (Three.js + vanilla JS + Tailwind).
- apps/workers: Cloudflare Workers and Durable Object backend.
- apps/sdk: embeddable npm package (@veltara/sdk).
- apps/portal: developer portal for docs, keys, usage, and playground.
- packages/shared: shared contracts (types, protocol, constants, utils).
- supabase/migrations: schema and policy migrations.
- docs: architecture and contributor documentation.

## Tech Stack

- Frontend: Vite, vanilla JavaScript, TailwindCSS, Three.js.
- Backend: Cloudflare Workers, Durable Objects, KV, R2, Workers AI.
- Data: Supabase Postgres + pgvector.
- Billing: Stripe subscriptions and credit packs.
- Monorepo: pnpm workspaces.

## Quick Start

1. Install dependencies:
	- pnpm install
2. Copy env template:
	- cp .env.example .env
3. Fill required values in .env.
4. Start local apps:
	- pnpm dev

Local defaults:
- Web: https://localhost:5173
- Portal: https://localhost:5174
- Workers: https://localhost:8787

For a complete setup walkthrough, see SETUP.md.

## Run With Docker

If you want local development without installing Node and pnpm directly, use Docker Compose.

1. Ensure .env exists (copy from .env.example and fill values as needed).
2. Build and start services:
	- docker compose up --build
3. Open apps:
	- Web: https://localhost:5173
	- Portal: https://localhost:5174
	- Workers: http://localhost:8787 (container-internal)

Useful commands:
- Stop: docker compose down
- Stop and remove volumes: docker compose down -v
- Follow logs: docker compose logs -f

Cleanup levels:
- Project containers + network + volumes: pnpm docker:clean
- Project cleanup + remove locally built project images: pnpm docker:clean:project
- Aggressive cleanup (includes global dangling Docker cache): pnpm docker:clean:hard

Notes:
- The compose stack includes a deps bootstrap service that installs workspace dependencies into compose volumes before web/portal/workers start.
- Web and Portal stay HTTPS for browser dev certs, while container-internal proxy traffic to Workers uses HTTP to avoid Wrangler TLS handshake noise in Docker logs.
- If dependencies get out of sync after package changes, rerun:
	- docker compose run --rm deps
- After dependency volume layout changes, do a one-time reset:
	- docker compose down -v
	- docker compose up --build

## Trusted Local HTTPS (mkcert)

For browser-trusted local HTTPS certificates:

1. Install mkcert on your machine.
2. Generate certificates into certs/:

Linux/macOS/WSL:
- pnpm certs:setup

Windows PowerShell:
- pnpm certs:setup:win

Generated files:
- certs/localhost.pem
- certs/localhost-key.pem

Both Vite apps automatically use these certs when present.

## Scripts

### Using pnpm directly
- `pnpm dev`: run web + workers + portal concurrently.
- `pnpm build`: build shared, sdk, web, and portal packages.
- `pnpm typecheck`: recursive type checks.
- `pnpm test`: recursive test execution.
- `pnpm clean`: remove common build artifacts.

### Using Makefile (Git Bash / Unix-like)
For a more familiar Unix-style development workflow, use the included Makefile:

```bash
make help        # Show all available targets
make dev         # Start dev server
make build       # Build all packages
make test        # Run tests
make typecheck   # Type check
make docker-up   # Start Docker stack
make docker-down # Stop Docker stack
```

Short aliases available: `make d`, `make b`, `make t`, `make tc`, etc.

**Requirements**: GNU Make or equivalent (`make` command available in your shell).
On Windows with Git Bash, this is available by default.

## Core Documentation

- docs/architecture.md
- docs/contributing.md
- SETUP.md

## Environment Variables

See .env.example for all expected values, including:

- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- JWT_SECRET
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_CONNECT_CLIENT_ID
- CF_ACCOUNT_ID
- CF_API_TOKEN

For local testing without real Stripe secrets:

- Copy .env.dev.example to .env.
- Copy apps/workers/.dev.vars.example to apps/workers/.dev.vars.
- Keep DEV_FAKE_STRIPE=true in apps/workers/.dev.vars.

This enables mocked billing endpoints while keeping the rest of the stack functional for development.

## CI/CD

- PR and main validation workflow: .github/workflows/ci.yml
- Main-branch deployment workflow: .github/workflows/deploy.yml

Deploy workflow expects these GitHub secrets:

- CF_ACCOUNT_ID
- CF_API_TOKEN
- CF_PAGES_PROJECT

## Current Status

The repository is scaffolded with core subsystems and contracts in place. Some subsystems still need integration hardening, expanded tests, and deployment strategy refinement before a production launch.

## License

MIT (see LICENSE).
