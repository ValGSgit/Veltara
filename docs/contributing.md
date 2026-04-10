# Contributing to Veltara

## Prerequisites
- Node.js 20+
- pnpm 9+
- Cloudflare account + Wrangler auth
- Supabase project or local Supabase CLI stack

## Setup
1. Install dependencies:
   - pnpm install
2. Copy environment values:
   - cp .env.example .env
3. Fill required values for local or shared dev environment.

## Development Commands
- Start core apps:
  - pnpm dev
- Type check all workspaces:
  - pnpm typecheck
- Run tests recursively:
  - pnpm test
- Build all app packages:
  - pnpm build

## Workspace Ownership
- apps/web: gameplay and UI experience.
- apps/workers: edge APIs and multiplayer state.
- apps/portal: developer onboarding and key management.
- apps/sdk: embeddable SDK and events API.
- packages/shared: contracts and utilities.

## Coding Guidelines
- Keep shared contracts source-of-truth in packages/shared.
- Validate external and user input with Zod before processing.
- Return consistent error format from Workers:
  { error: { code, message, status } }
- Avoid duplicating protocol or region constants outside shared.
- Prefer small, reviewable commits by subsystem.

## Testing Expectations
- Unit tests for shared utilities and worker business rules.
- Add regression tests when fixing bugs.
- Validate API behavior with both success and failure paths.

## Pull Request Checklist
- [ ] Changes are scoped and described clearly.
- [ ] Type checks pass.
- [ ] Tests pass or testing gap explained.
- [ ] README/docs updated when behavior changes.
- [ ] New environment variables documented in .env.example.

## Branch and Commit Conventions
Recommended branch prefixes:
- feat/
- fix/
- chore/
- docs/

Recommended commit style:
- feat(scope): short summary
- fix(scope): short summary
- docs(scope): short summary

## Security and Secrets
- Never commit real secrets.
- Use Wrangler secrets and GitHub Actions encrypted secrets.
- Do not log raw API keys, tokens, or sensitive user content.
