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

## 5. Optional: Run Supabase Locally
If you use Supabase CLI:
```bash
supabase start
supabase db push
```
Then update .env values to local Supabase URLs/keys.

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
- Workers: https://localhost:8787

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
- If browser warns about local HTTPS certificates, run the mkcert setup commands above.
- If compose services fail with commands like vite/wrangler not found, run:
	```bash
	docker compose run --rm deps
	```
