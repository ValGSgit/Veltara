# Veltara Architecture

## Overview
Veltara is a pnpm monorepo with five primary surfaces:

- apps/web: consumer-facing immersive Three.js app.
- apps/workers: Cloudflare Workers API surface and Durable Objects.
- apps/portal: developer portal for key management, docs, and playground.
- apps/sdk: embeddable JavaScript SDK package (@veltara/sdk).
- packages/shared: shared contracts (types, protocol, constants, utils).

The architecture emphasizes edge execution for low-latency multiplayer and a shared protocol across frontend, SDK, and workers.

## Runtime Topology

### Frontend Runtime
- apps/web uses Vite + vanilla JavaScript + Three.js.
- World rendering is client-side (planet shader pipeline, regions, players, minimap, HUD).
- Real-time updates are received via region WebSocket channels.

### Backend Runtime (Cloudflare)
- Primary APIs run as Cloudflare Workers.
- Multiplayer region state is owned by the RegionRoom Durable Object.
- KV is used for fast shared state and cache-like lookup patterns.
- R2 stores media and static assets (avatars, post media, cosmetics).
- Workers AI is used for moderation, embeddings, and event generation.

### Data Runtime (Supabase)
- Supabase Postgres stores durable social and billing metadata.
- pgvector extension supports embedding similarity operations.
- RLS policies are defined in the initial migration for client-safe access models.

## API and Worker Boundaries

### planet-api
Responsibilities:
- region listings
- world-state reads
- player join orchestration
- region WebSocket delegation
- event triggering

### auth-worker
Responsibilities:
- register/login/refresh/logout/me
- refresh-token lifecycle
- JWT issuance/verification integration

### social-worker
Responsibilities:
- feed, posts, comments, follows
- profile and leaderboard endpoints
- optional media upload flow to R2

### ai-worker
Responsibilities:
- moderation endpoint
- recommendation endpoint
- embeddings generation and persistence

### stripe-worker
Responsibilities:
- subscriptions and billing portal
- webhook processing
- credit purchases and marketplace purchase flow

### api-worker (Developer API)
Responsibilities:
- API key lifecycle
- usage metrics endpoint
- /v1 public B2B endpoints
- embed session issuance

## Real-time Multiplayer Flow
1. Client authenticates and joins a region via planet-api.
2. Client opens region WebSocket endpoint.
3. planet-api forwards socket upgrade to RegionRoom DO instance for that region.
4. RegionRoom validates token and sends initial state.
5. Player position and chat updates are validated and broadcast in-region.
6. World-state and global events are broadcast from cron/background updates.

## Shared Contracts
packages/shared defines:
- canonical region model and constants
- websocket protocol schemas (Zod)
- shared utility functions (geo, sanitization, timing, backoff)
- common domain types

This package is imported by web, workers, and sdk to reduce drift.

## Security Model
- JWT-protected user endpoints.
- API-key middleware for B2B endpoints.
- key hashing before persistence.
- centralized error response structure.
- origin-restricted CORS policy.
- RLS policy baseline in migration.

## Deployment Model
- Workers deployment via Wrangler.
- Portal deployed as static output (Cloudflare Pages compatible).
- Environment-separated deployment paths (development/staging/production).
- CI workflow runs type checks/tests/build; deploy workflow targets main branch.

## Known Follow-up Work
- verify all worker entrypoints and wrangler service split strategy.
- harden billing and marketplace transactional consistency.
- add full e2e coverage for auth and portal key workflows.
- complete production observability integration (Sentry DSN wiring).
