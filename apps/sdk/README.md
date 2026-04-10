# @veltara/sdk

Official JavaScript/TypeScript SDK for embedding Veltara planets in your applications.

## Installation

```bash
npm install @veltara/sdk
# or
pnpm add @veltara/sdk
```

Three.js is a peer dependency:
```bash
npm install three
```

## Quick Start

```html
<div id="planet-container" style="width: 600px; height: 400px;"></div>
```

```ts
import { VeltaraEngine } from '@veltara/sdk';

const engine = new VeltaraEngine({
  apiKey: 'vlt_your_api_key_here',
  container: '#planet-container',
  region: 'nexus-core',
  theme: {
    primaryColor: '#6c63ff',
    showUI: true,
    showChat: false,
  },
  onReady: () => {
    console.log('Planet is ready!');
  },
  onPlayerJoin: (player) => {
    console.log(`${player.username} joined the region`);
  },
  onRegionEvent: (event) => {
    console.log(`Event: ${event.title}`);
  },
});

await engine.mount();
```

## API Reference

### `new VeltaraEngine(options)`

| Option | Type | Description |
|---|---|---|
| `apiKey` | `string` | Your API key (starts with `vlt_`) |
| `container` | `string \| HTMLElement` | CSS selector or element to mount into |
| `region` | `RegionId` | Starting region (default: `nexus-core`) |
| `theme` | `VeltaraTheme` | Visual customization |
| `onReady` | `() => void` | Called when planet is displayed |
| `onPlayerJoin` | `(player: Player) => void` | Called when a player joins |
| `onPlayerLeave` | `(player: Player) => void` | Called when a player leaves |
| `onRegionEvent` | `(event: RegionEvent) => void` | Called on region events |
| `onError` | `(error: Error) => void` | Called on SDK errors |

### Methods

```ts
await engine.mount()                    // Mount the planet
engine.unmount()                        // Unmount and clean up
await engine.setRegion('aurora-basin')  // Switch to a different region
await engine.triggerEvent('custom_event', { data: 'value' })
const count = await engine.getOnlineCount()
const regions = await engine.getRegions()
engine.on('player_join', handler)
engine.off('player_join', handler)
```

### Regions

| ID | Name |
|---|---|
| `aurora-basin` | Aurora Basin |
| `equator-ridge` | Equator Ridge |
| `crimson-desert` | Crimson Desert |
| `verdant-reaches` | Verdant Reaches |
| `abyssal-trench` | Abyssal Trench |
| `storm-peaks` | Storm Peaks |
| `nexus-core` | Nexus Core |
| `void-cradle` | Void Cradle |

### API Key Tiers

| Tier | Requests/day | Watermark | Custom branding |
|---|---|---|---|
| Sandbox (free) | 1,000 | Yes | No |
| Indie ($19/mo) | 50,000 | No | No |
| Studio ($79/mo) | 500,000 | No | Yes |
| Enterprise ($299/mo) | Unlimited | No | Yes + SLA |

Get your API key at [dev.veltara.gg](https://dev.veltara.gg).

## License

MIT
