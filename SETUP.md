# Veltara Local Setup (Under 10 Minutes)

## 1. Requirements
- Node.js 20+
- pnpm 9+
- Cloudflare Wrangler CLI access
- Optional: Supabase CLI for local DB

## 2. Clone and Install
```bash
pnpm install
```

## 3. Environment Variables
1. Copy template:
```bash
cp .env.example .env
```
2. Fill at minimum:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- JWT_SECRET
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- CF_ACCOUNT_ID
- CF_API_TOKEN

### Fast local dev mode (no real Stripe secrets)
Use this when you want to test product flows before provisioning production credentials.

1. Copy local-safe env values:
```bash
cp .env.dev.example .env
cp apps/workers/.dev.vars.example apps/workers/.dev.vars
```
2. Keep `DEV_FAKE_STRIPE=true` in `apps/workers/.dev.vars`.
3. Optional: keep `DEV_BOOTSTRAP_ACCOUNT=true` in `apps/workers/.dev.vars` to enable a default local login:
	- Email: `dev@veltara.local`
	- Password: `devpassword123!`
	- The user is auto-created on first successful login.
4. Start stack:
```bash
pnpm dev
```

Notes:
- Auth, world, social, API key flows still require Supabase values.
- Billing endpoints run in mocked mode and return simulated checkout/portal URLs.
- Deployment still requires real Cloudflare secrets and should use production env values.

## 4. Start Apps
Run web + workers + portal concurrently:
```bash
pnpm dev
```

Optional but recommended for trusted HTTPS certs (no browser warning):

Linux/macOS/WSL:
```bash
pnpm certs:setup
```

Windows PowerShell:
```powershell
pnpm certs:setup:win
```

Default local URLs:
- Web app: https://localhost:5173
- Portal: https://localhost:5174
- Workers dev endpoint: https://localhost:8787

## 5. Supabase Setup (Recommended)

Install Supabase CLI first, then from repo root:

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:status
```

What this gives you:
- Local Postgres + Auth + Storage + Studio
- All Veltara app tables from `supabase/migrations/001_initial.sql`

Open Supabase Studio:
- http://127.0.0.1:54323

To inspect all tables/columns/indexes/RLS quickly:
1. Open SQL Editor in Studio.
2. Run `supabase/sql/inspect_schema.sql`.

Then update your `.env` with local values from `pnpm supabase:status`:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY

Remote project (later):
```bash
pnpm supabase:link -- --project-ref <your-project-ref>
pnpm supabase:push
```

## 6. Validate the Workspace
```bash
pnpm typecheck
pnpm test
pnpm build
```

## 7. Deploy Workers (when ready)
```bash
pnpm --filter @veltara/workers deploy
```

## 8. Deploy Portal (Cloudflare Pages compatible)
Build output is generated at apps/portal/dist:
```bash
pnpm --filter @veltara/portal build
```
Use your Pages workflow or wrangler pages deploy with your project name.

## 9. Containerized Local Development (Docker)
If you prefer running everything in containers:

```bash
docker compose up --build
```

Services and ports:
- Web app: https://localhost:5173
- Portal: https://localhost:5174
- Workers: http://localhost:8787 (container-internal)

Shutdown:

```bash
docker compose down
```

Full cleanup including compose volumes:

```bash
docker compose down -v
```

Project cleanup including local project images:

```bash
pnpm docker:clean:project
```

Aggressive cleanup including global dangling cache:

```bash
pnpm docker:clean:hard
```

## Troubleshooting
- If TypeScript cannot find Worker types, ensure dependencies are installed in apps/workers.
- If portal styles are missing, confirm apps/portal/src/styles/portal.css exists.
- If ws calls fail locally, verify Vite proxy and Wrangler dev are both running.
- In Docker Compose, Web/Portal proxy to Workers over HTTP internally (`http://workers:8787`) even when browser-facing app URLs are HTTPS.
- If browser warns about local HTTPS certificates, run the mkcert setup commands above.
- If compose services fail with commands like vite/wrangler not found, run:
	```bash
	docker compose run --rm deps
	```
- If that still fails, reset volumes and rebuild:
	```bash
	docker compose down -v
	docker compose up --build
	```
