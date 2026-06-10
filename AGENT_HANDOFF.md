# Veltara Agent Handoff

## Completed Foundations
- Monorepo bootstrap with pnpm workspace and TypeScript base config.
- Shared contracts package implemented.
- Initial Supabase migration created with RLS baseline.
- Workers scaffold added (planet-api, auth, social, ai, stripe, api-worker, durable object).
- Web app scaffold added (Three.js planet + UI modules).
- SDK scaffold added.
- Developer portal scaffold added.
- Missing docs and CI/workflow files now added.
- Missing portal stylesheet now added.

## Files Added/Modified in This Continuation
- apps/portal/src/styles/portal.css
- docs/architecture.md
- docs/contributing.md
- SETUP.md
- .github/workflows/ci.yml
- .github/workflows/deploy.yml
- AGENT_HANDOFF.md
- .gitattributes
- apps/workers/src/swagger.ts (Swagger API Documentation)
- apps/web/src/planet/sandbox.js (Region Sandbox Gameplay Improvements)
- apps/web/src/main.js (Animation Loop Updates)
- apps/web/src/planet/planet-model.js (Enhanced Atmosphere Shaders)

## Remaining Work To Reach Production-Ready / Next Steps
1. **Run full install** and fix runtime/type errors across all apps.
2. **Cloudflare Bindings:** Validate all worker routes against real Cloudflare bindings and split deployment strategy.
3. **Transaction Semantics:** Harden social/marketplace/billing transaction semantics.
4. **Testing:** Add/repair tests for auth, API key middleware, websocket protocol, stripe webhooks.
5. **UI Polish:** Verify portal pages with live APIs and handle edge cases for auth token lifecycle.
6. **Regions Gameplay Expansion:**
   - *Physics:* Add gravity (falling objects), bounding box collisions, and physics-based stacking.
   - *Interactive Elements:* Add trigger tiles, bouncy/slippery surfaces, or environmental hazards.
   - *Visual Feedback:* Add fade-out effects on deletion, pulse/glow on selection. 
   - *Broadcasting Optimization:* As regions grow, implement interest-based culling, delta updates, or spatial partitioning instead of broadcasting the full state every time.
   - *Audio:* Implement SFX for object placement, UI interaction, and ambient region sound.
7. **Review Wrangler Route Strategy** for multi-worker architecture.

## Immediate Commands
```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Expected Environment Secrets in CI
- CF_ACCOUNT_ID
- CF_API_TOKEN
- CF_PAGES_PROJECT

## Notes
- Current deploy workflow assumes wrangler-based worker deploy from apps/workers and Pages deploy for apps/portal.
- If Cloudflare setup uses separate workers per route, replace single wrangler deploy with per-service deploy jobs.

---

## Cloudflare Free-Tier Safeguards

### R2 Storage (10 GB / 1M Class A / 10M Class B free)
- **Global storage cap**: 9 GB hard limit tracked via `KV_WORLD["r2:total_bytes"]` — leaves 1 GB headroom
- **Per-file limit**: 4 MB (down from 8 MB) — set in `R2_FREE_TIER.MAX_MEDIA_BYTES`
- **Per-user daily uploads**: 5/day — tracked via `KV_WORLD["r2:uploads:{uid}:{date}"]`
- **Only R2 write path**: `social-worker.ts` → `handleCreatePost` media upload (Class A: PUT)
- **No R2 reads in workers** — media served via R2 public bucket / custom domain (Class B)

### KV Operations (100K reads/day, 1K writes/day free)
- **World-state cron**: changed from `*/1` → `*/5 * * * *` (288 invocations/day, ~576 KV writes/day)
- **Event generation cron**: changed from `0 */2` → `0 */6 * * *` (4 invocations/day, ~12 KV writes/day)
- **Total estimated KV writes/day**: ~600 (within 1K limit)
- **Total estimated KV reads/day**: ~1,200 (within 100K limit)

### Workers AI
- Event generation now runs 4×/day instead of 12×/day — saves AI inference units

### Constants
All free-tier limits centralized in `packages/shared/src/constants.ts` under `R2_FREE_TIER` and `KV_FREE_TIER`.

---

## Region Sandbox Gameplay Improvements (New)

### Fluid Placement & Object Lifecycle (`sandbox.js`, `main.js`)
- **Lerped Transform Updates:** Replaced rigid teleporting of objects during updates with seamless frame-by-frame linear interpolation (`.lerp()`) for position and scale, and linear interpolation for rotation vectors.
- **Physics Spawn "Pop-In":** Rather than popping in instantly, newly placed network objects spawn at `0.01` scale and bounce smoothly to `1.0` using a dynamic `Math.sin()` spring/overshoot computation in the newly added `update()` loop.
- **Continuous Idle Behaviors:** Special object kinds (like 'orb') rotate gracefully and lightly bob on the Y-axis using the global elapsed time, significantly improving environmental motion within the sandbox structure.

### API & Worker Architecture Refinements
- **Swagger Documentation:** Scaffolded OpenAPI schema available dynamically at `/api/docs` mapping to `/api/openapi.json`, powered by `swagger.ts` and covering Public Game APIs, Developer Auth, and Portal management.
- **UI Structure Cleanup:** Extraneous static padding classes have been optimized out of `AuthModalView.vue`.

---

## 3D Rendering Improvements

### Earth Model (`planet-model.js`)
- **Dual-layer atmosphere**: outer Fresnel glow (r=1.055) + tight inner rim (r=1.025), both with sun-facing brightening and twilight terminator band (warm orange at the shadow edge)
- **Dedicated lighting rig**: key sunlight (warm 2.2 intensity), hemisphere ambient (sky blue / deep blue ground, 0.35), fill light from behind for dark-side definition
- **Sun sync**: Earth atmosphere uniforms + directional light position update every frame from the main Veltara day/night cycle (`planet.sunDirection`)
- **Material enrichment**: loaded GLB materials get roughness capped at 0.85, slight metalness floor (0.02), envMapIntensity 0.4 for subtle reflections

### Black Hole Model (`planet-model.js`)
- **Dark event horizon core**: true-black sphere (r=0.42) rendered first to sell the void
- **Hot inner core glow**: tight bright sprite (r=2.2) with white→orange→purple falloff, animated pulse
- **Multi-layer corona**: warm orange corona (r=4.8) + wide purple lens flare (r=7.0), both additive/non-tone-mapped with independent pulse cycles
- **Shader accretion ring**: custom GLSL torus (r=1.6) with hot-yellow inner → orange mid → purple outer gradient, animated brightness waves and flicker
- **Secondary outer ring**: thin purple torus (r=2.3) counter-rotating for depth
- **Gravitational lensing ring**: bright edge halo (ring geometry at r=0.95–1.15) simulating light bending at the photon sphere
- **600 orbiting particles**: Kepler-speed distribution (inner=fast, outer=slow), warm-to-purple color gradient, per-frame position update with wobble
- **Polar plasma jets**: two opposing cones with pulsing opacity, selling the relativistic jet effect
- **Dedicated point light**: orange-tinted (1.5 intensity) at center for accretion glow on the model mesh

All 512px canvas textures (up from 256px) for sharper glow at close zoom.

---

## UI/UX Architecture Refactor Pass

### main.js god-file extraction (1210 → 310 lines)
Refactored the monolithic `apps/web/src/main.js` into 4 focused engine modules under `apps/web/src/engine/`:

**socket-handler.js**
- Exports: `getSocket()`, `isConnected()`, `sendMessage(type, payload)`, `connectToRegion(regionId, token, deps)`, `startPositionBroadcast()`
- All WebSocket lifecycle: connection, reconnect backoff, event routing, 15-second ping interval
- `deps = { sandbox, players }` passes Three.js objects in without circular imports
- Position broadcast loop: 500ms, only sends on change

**sandbox-actions.js**
- Exports: validation helpers (`normalizeObjectName`, `normalizeUserId`, `normalizeModelKey`, `sanitizeCreateKind/Material/ModelKey`, `getMetadataValidationError`, `getModelKeyValidationError`, `getNodeType`, `canRepairObject`)
- Exports: `handleSandboxAction(action, sandbox)` — unified dispatcher replacing 150-line if-chain
- Lookup table for simple interactions; structured handlers for set-name, set-model-key, grant/revoke-builder

**keyboard.js**
- Exports: `initKeyboardShortcuts(deps)` with deps `{ sandbox, leaveRegionLand }`
- Planet view: 1/2/3 for planet switching
- Region land: Escape to exit, B for build mode, object shortcuts (Delete/R/L/U/P/T/C/G/H) via lookup table
- Skips input/textarea targets properly

**bootstrap.js**
- Exports: `createLoadingScreen()`, `bootstrap(deps)` with deps `{ earthPlanet, blackHolePlanet, setActivePlanet, sandbox, players }`
- Weighted progress tracker: model 75%, session 8%, planet-join 10%, regions 7%
- Startup sequence: model load → session restore → planet join → onboarding check → region load → dismiss screen → start position broadcast

### Dead code removed
- **Deleted**: `apps/web/src/ui/hud.js` (268 lines) — vanilla HUD replaced by Vue AppShell
- **Removed**: `mountQuickPlanetSwitcher()` — duplicated Vue planet-switcher in AppShell
- **Deleted**: `apps/web/src/ui/lobby-shell.js` — single-line proxy, replaced by direct import
- **CSS cleanup** (`apps/web/src/styles/main.css`): removed dead `#top-bar`, `#bottom-bar`, `#region-panel`, `#nearby-panel`, `#chat-panel` rules + their responsive blocks (~80 lines)

### PanelDrawerView UX polish
- Added fullscreen backdrop overlay (semi-transparent, blur) with click-to-close
- Semantic title/subtitle header mapping by panel type (profile/social/store/settings)
- Content reorganized into `PanelCard` components (profile stats, bio, achievements each in own card)
- Store category selector uses `PillButton` active-state
- Social composer has `canSubmitPost` guard (disables when empty or loading)

### UI atoms
- `apps/web/src/frontend/components/ui/PanelCard.vue` — glass card primitive with compact variant
- `apps/web/src/frontend/components/ui/PillButton.vue` — pill button with `active` state and size variants
- Used across HomeView, LobbyView, AppNavBar, PanelDrawerView, SocialHubView

### Home-first social architecture
- `HomeView` is the social hub: regions, nearby players, chat, events
- `LobbyView` is planet-focused command layout without duplicated social
- URL routing: `/home`, `/planet`, `/profile`, `/shop` — handled in `AppShell.js` + `useAppShellActions.js`
- `popstate` handling for browser back/forward

---

## Code Review + Bug Fix Pass

### Bugs fixed

**socket-handler.js — position_update null spread**
- `p` could be `undefined` (player not yet in map). Now: `const merged = p ? { ...p, ...payload } : payload`; always upserts into both store and 3D scene.

**store.js — update() state visibility during batch**
- `update()` previously mutated one key and immediately fired that key's listeners before the next mutation applied. Listeners for early keys saw stale values for keys that hadn't been applied yet.
- **Fix**: All mutations applied first, then all listeners fired. Observers of `*` always see fully-settled state.

### Redundancy removed

**lobby-shell.js deleted** — was `export function mountLobbyShell() { mountAppShell(); }`. `main.js` now imports `mountAppShell` directly from `./frontend/AppShell.js`.

**AppShell.js planet switcher condition simplified**
- Was: `sceneMode !== 'region-land' && currentPage === 'planet' && !(currentPage === 'planet' && activePlanetId === 'black-hole')`
- Now: `sceneMode !== 'region-land' && currentPage === 'planet' && activePlanetId !== 'black-hole'`

---

## Current Architecture (post all passes)

```
apps/web/src/
  main.js                       — 310 lines, pure orchestration
  engine/
    socket-handler.js           — WebSocket lifecycle + all socket events
    sandbox-actions.js          — sandbox interactions + validation
    keyboard.js                 — all keyboard shortcuts
    bootstrap.js                — loading screen + startup sequence
  state/
    store.js                    — event-emitter reactive store (batch-safe)
  network/
    api.js                      — REST client + session restore + token refresh
    websocket.js                — RegionSocket with exponential backoff
  frontend/
    AppShell.js                 — Vue 3 root, mounts to #hud
    components/
      AppNavBar.vue             — top nav, location-aware links
      PanelDrawerView.vue       — profile/social/store/settings drawer + backdrop
      AuthModalView.vue         — login/register modal
      SandboxOverlay.vue        — sandbox build mode HUD
      ui/
        PanelCard.vue           — glass card primitive
        PillButton.vue          — pill button with active state
    views/
      HomeView.vue              — social hub (regions, nearby, chat, events)
      LobbyView.vue             — planet command layout
      WelcomeView.vue           — unauthenticated landing
    composables/
      useAppShellActions.js     — all navigation + action logic for AppShell
  planet/
    planet-model.js             — GLB/FBX model loader + Black Hole effects (GLSL shaders, particles)
    procedural-earth.js         — fully procedural Earth (noise textures, day/night, clouds, atmosphere)
    planet.js                   — Veltara procedural planet
    camera.js                   — CameraController (spherical coords, orbit)
    regions.js                  — RegionMarkers 3D overlays
    players.js                  — PlayerDots (instanced mesh)
    sandbox.js                  — RegionSandboxLayer (object placement/selection)
    region-land.js              — RegionLandScene (first-person region view)
    minimap.js                  — Minimap canvas overlay
  styles/
    main.css                    — Tailwind + custom CSS (no dead HUD rules)

apps/workers/src/
  planet-api.ts                 — main game API worker + cron handler
  social-worker.ts              — social feed + R2 upload with free-tier guards
  (other workers...)

packages/shared/src/
  constants.ts                  — R2_FREE_TIER, KV_FREE_TIER, cron intervals
```

---

## April 2026 Bug Fix + Polish Pass (Third)

### Functional bugs fixed

**Position broadcast always sending 0,0**
- `selfLat`/`selfLon` in the store were initialized to `0` and never updated.
- The `teleport-to-region` event handler in `main.js` sent the correct lat/lon to the server but never updated the store, so the position broadcast loop (which reads from the store) always sent `0,0`.
- **Fix**: Added `store.set('selfLat', region.lat)` and `store.set('selfLon', region.lon)` in the teleport handler before broadcasting.
- **File**: `apps/web/src/main.js`

**No token refresh during active session (mid-session 401)**
- `api.restoreSession()` handled 401s at startup by trying `refreshToken()` + retry, but any API call made *during* a session that hit a 401 (expired access token) would throw immediately with no retry.
- **Fix**: Extracted `_fetch()` helper; `_request()` now intercepts 401 responses and attempts `refreshToken()` + retry once before throwing. Covers all API calls automatically.
- **File**: `apps/web/src/network/api.js`

### CSS token consolidation (`apps/web/src/styles/main.css`)
Extracted 9 most-repeated raw `rgba()` values into CSS custom properties on `:root`:
- `--glass-border` (`rgba(148, 163, 184, 0.12)`) — was repeated in ~12 selectors
- `--glass-border-mid` (`rgba(148, 163, 184, 0.18)`)
- `--glass-bg` (`rgba(255, 255, 255, 0.025)`) — was repeated in ~10 selectors
- `--glass-bg-soft` (`rgba(255, 255, 255, 0.035)`)
- `--glow-border` (`rgba(79, 255, 176, 0.28)`) — repeated hover glow in 8+ selectors
- `--glow-bg` (`rgba(79, 255, 176, 0.06)`)
- `--accent-border` (`rgba(165, 211, 255, 0.2)`)
- `--accent-active-bg` (gradient repeated across planet switcher, sandbox btn, pill active states)
- `--pill-transition` (transition shorthand repeated verbatim in 6+ selectors)

Updated: `.metric-tile`, `.event-card`, `.spotlight-region`, `.region-card`, `.player-row-vue`, `.chat-message-vue`, `.status-pill/.icon-button/.cta-button/.mini-chip/.chat-tab-vue`, `.planet-switcher__btn`, `.sandbox-action-btn`, `.sandbox-stat-card`, `.sandbox-overlay__selection`, `.sandbox-hotkey-pill`.

Added hover transition to `.planet-switcher__btn` (was missing).

---

## April 2026 UI/UX Rewrite Pass (Fourth)

### Views rewritten

**WelcomeView.vue** — complete rewrite
- Real product copy throughout (removed all dev-note placeholder text)
- Hero: gradient title, sub-copy, conditional CTAs (register/sign-in when logged out; enter planet/go home when logged in)
- Animated badge (pulsing ring + gradient core)
- Feature grid: 4 cards — Shared Planet, Real-time Presence, Region Builder, Planet Chat
- Responsive: 900px hides badge + collapses features to 2-col; 560px features go 1-col
- CSS variables throughout; scoped styles only

**LobbyView.vue** — complete rewrite
- **Removed** "Lobby Layout" debug panel (checkboxes for toggling sections) — was developer tooling, not real UX
- **Removed** `lobbyViewOptions` prop and all related logic
- **Removed** duplicate brand/logo from topbar (AppNavBar already owns it)
- New status strip: online count / region count / events count / clock pills + action buttons (Feed, Store, Profile, Quick jump)
- Clean 2-col grid: regions panel (left) + center column (world card + lower row)
- World card: `lobby__conn-badge` with three states (Synced/Reconnecting/Offline)
- Lower row: events panel + spotlight panel — always rendered, no toggles
- Footer: interaction hints + player avatar/name/region
- All scoped styles with BEM-like `.lobby__*` naming

**HomeView.vue** — complete rewrite
- 2-col hero: content left + stats column right (4 tile grid: Online now / Your region / Hotspot / World cycle)
- Stats column collapses to horizontal row at 860px, 2×2 grid at 560px
- Conditional events section (hidden when no active events)
- Events in `auto-fill` grid (min 240px per card) with hover lift
- Clean button primitives: `home-btn--primary` (gradient) + `home-btn--ghost` (glass)

**AppNavBar.vue** — complete rewrite
- **Fixed**: Brand click now navigates to `'home'` when authenticated, `'welcome'` when not
- **Added**: `wsReconnecting` + `wsLatency` props; status badge shows Reconnecting (amber) / Online (green) / Offline (red) with latency `ms` in mono font when connected
- **Added**: `app-nav__context-badge` for region-land context (Build/Region + region name), styled in glow green to distinguish from connection status
- **Added**: `app-nav__user` button (avatar + name) that opens profile panel on click — replaces the plain `<span>` that did nothing
- **Added**: Full scoped styles (AppNavBar previously had no `<style>` block at all)
- Nav links rendered from data array — no repeated `PillButton` blocks
- Responsive: links hidden at 680px, brand title + username hidden at 440px

### Dead code removed

**`lobbyViewOptions` + `setLobbyViewOption`** — fully deleted
- Removed `DEFAULT_LOBBY_OPTIONS`, `hydrateLobbyOptions()`, `setLobbyViewOption()` from `useAppShellActions.js`
- Removed `LOBBY_OPTIONS_KEY` constant and `lobbyOptionsHydrated` flag
- Removed `lobbyViewOptions` default from `state/store.js`
- Removed `:lobby-view-options` and `:set-lobby-view-option` bindings from AppShell.js template

**AppShell.js** — `lobbyViewOptions` bindings to LobbyView removed; new `wsReconnecting` + `wsLatency` wired to AppNavBar

## June 2026 Maintainability + Procedural Earth Pass (Fifth)

### Critical fix: sign-in restored
The previous commit left `AuthModalView` commented out in `AppShell.js` — including
`//`-prefixed lines *inside the template string*, which Vue renders as literal text.
Logged-out users had no way to authenticate (bootstrap's `showLoginModal()` set
`authModal` in the store but nothing rendered it). Component registration, the
`authModal` computed, and the template block are restored.

### Earth model replaced with procedural Earth
- **New**: `apps/web/src/planet/procedural-earth.js` (`ProceduralEarth`) — same interface
  as `PlanetModel` (`group`, `setVisible`, `loadIfNeeded({onProgress})`, `update`,
  `setSunDirection`), so `main.js`/`bootstrap.js` integration is unchanged.
- All textures generated at load from seeded 3D value-noise fbm sampled on the sphere
  (seam-free): day map (continents/ice/ocean, land mask in alpha for ocean-only specular),
  night map (city-light clusters), cloud map. Generation is chunked by rows so the
  loading bar animates. Uses `DataTexture` — canvas `putImageData` premultiplies alpha
  and would black out oceans (land mask alpha = 0).
- Custom shaders: day/night terminator with warm twilight band, ocean specular glint,
  independent cloud-layer drift, dual-layer fresnel atmosphere (params carried over from
  the GLB Earth's tuned atmosphere).
- **Deleted**: `apps/web/public/models/earth-00.glb` (56 MB — recoverable from git
  history). Earth-specific branches removed from `planet-model.js` (now the GLB/FBX +
  black-hole loader only).

### three r128 API fix
`renderer.outputColorSpace = THREE.SRGBColorSpace` and `texture.colorSpace` are r152+
APIs — under three 0.128 they were silently no-ops (Rollup warned "not exported").
Replaced with `outputEncoding`/`encoding` + `sRGBEncoding` in `main.js` and
`ModelLabModal.vue`.

### UI declutter
- **LobbyView**: removed the duplicated Profile/Feed/Store button rows (they appeared in
  the status strip, world card, and spotlight); removed metric tiles duplicating the
  status strip (Explorers/World cycle); spotlight keeps only Teleport. The planet view
  breathes more.
- **Planet switcher** in AppShell is data-driven (`PLANET_OPTIONS`) with clean labels
  (Menu / Veltara / Earth) instead of three copy-pasted buttons with dev labels.

### Maintainability
- `main.js`: planet/marker/minimap visibility logic deduplicated into
  `applyPlanetVisibility(activePlanetId)` (was repeated 3×).
- `useAppShellActions.navigate()`: 30-line if-chain replaced by a `PAGES` map that owns
  each page's path + associated panel.
- **Deleted dead code**: `ui/panels.js` (listened for an `open-panel` DOM event nothing
  dispatches), `ui/onboarding.js` (one-line re-export shim), `SupabaseTodosView.vue`
  (unused demo component; importing it would throw without Supabase env vars).

## Known Remaining Work
1. **Unit tests** — engine modules (socket, keyboard, sandbox, bootstrap) have no test coverage
2. **selfLat/selfLon during region-land** — still `0,0` once *inside* the region land scene (no camera-to-lat/lon conversion). Fixed for the outer planet view but region-land mode doesn't update position.
3. **`earth-test` planet id** — kept for store/keyboard compatibility; rename to `earth` would touch store defaults, keyboard shortcuts, and switcher options together.
