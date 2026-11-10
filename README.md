# NEON STORM

NEON STORM is a browser-based twin-stick arena shooter. Pilot a neon ship, survive escalating waves of geometric enemies, collect geoms to build a score multiplier, and use bombs when the arena gets crowded.

## Live Demo

No public deployment URL is configured in this repository yet. Add the live URL here when the game is published.

## Preview

No screenshots or preview images are currently included in the repository.

## Features

- Wave-based arena survival with six enemy types, including splitters and fast fragments.
- Keyboard, mouse, and dual virtual-stick touch input.
- Aim and fire while moving; use expanding bomb shockwaves to clear the arena.
- Collect geoms to increase the score multiplier, up to ×9.
- Easy, normal, and hard difficulty settings.
- Canvas effects including a reactive grid, glowing sprites, particles, and screen shake.
- Procedurally synthesized sound effects and music using the Web Audio API.
- Pause, restart, and game-over screens, plus locally saved settings and best score.

## Technology

- React 19 and TypeScript 5
- HTML5 Canvas 2D API for the game engine
- Vite 7 and `vite-plugin-singlefile`
- Tailwind CSS 4
- Web Audio API for synthesized audio
- Lucide React for interface icons

## Gameplay and Controls

| Action | Keyboard and mouse | Touch |
| --- | --- | --- |
| Move | `W`/`A`/`S`/`D` or arrow keys | Drag the left virtual stick |
| Aim | Move the mouse | Drag the right virtual stick |
| Fire | Hold the left mouse button | Hold/drag the right virtual stick |
| Use a bomb | `Space`, `Q`, or `E`; right- or middle-click | Tap the bomb button |
| Pause or resume | `Escape` or `P` | Tap the pause button |

On touch devices, the virtual sticks begin where each thumb touches: the left half of the play area controls movement, and the right half controls aim and firing. On the game-over screen, press `Enter` or `R` to retry.

Collect geoms dropped by enemies to raise the score multiplier; taking a hit resets it. Waves grow more demanding, and every third wave includes a ring surge. The field manual in the game describes the enemy types and survival systems.

## Getting Started

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (the range required by Vite 7)
- npm
- Git, if cloning the repository

### Clone and install

Replace `<repository-url>` with the URL of your repository:

```sh
git clone <repository-url> neon-storm
cd neon-storm
npm ci
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json`.

### Run the development server

```sh
npm run dev
```

Open the local URL printed by Vite in your browser.

### Build for production

```sh
npm run build
```

Vite writes the production build to `dist/`. The configured single-file plugin bundles the app into an HTML entry point.

### Preview the production build

```sh
npm run preview
```

Run this after building, then open the local preview URL printed by Vite.

## Project Structure

```text
.
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── components/
    │   ├── GameCanvas.tsx
    │   ├── HUD.tsx
    │   ├── Overlays.tsx
    │   ├── Screens.tsx
    │   └── SettingsPanel.tsx
    ├── game/
    │   ├── audio.ts
    │   ├── engine.ts
    │   ├── input.ts
    │   └── types.ts
    ├── state/
    │   └── settings.ts
    └── utils/
        └── cn.ts
```

## Technical Overview

- **Rendering and game loop:** `src/game/engine.ts` owns the Canvas 2D game world. A `requestAnimationFrame` loop advances simulation and draws the scene; elapsed frame time is capped to avoid unusually large update steps. The canvas resizes with its container and scales for device pixel ratio.
- **Gameplay and collisions:** The engine updates the player, bullets, enemies, geoms, pickups, and effects, then resolves their interactions with distance-based collision checks. Wave timing and enemy spawns are managed by the engine.
- **Input:** `src/game/input.ts` combines keyboard and mouse events with two pointer-driven virtual sticks. `GameCanvas` connects the engine to React HUD, pause, and game-over UI.
- **Audio:** `src/game/audio.ts` creates oscillators, filters, noise, and a sequenced music loop with the Web Audio API. The game does not require bundled audio files.
- **Settings and records:** `src/state/settings.ts` stores player settings and best-score data in browser `localStorage`.

## Deployment

This is a client-side Vite app and has no server-side runtime requirement. Build it with `npm run build`, then publish the contents of `dist/` to a static web host configured to serve `index.html`. The repository does not configure a particular hosting provider or deployment pipeline.

## Contributing

Contributions are welcome. For substantial changes, open an issue or discussion first so the intended approach can be agreed on. Keep pull requests focused, describe user-visible changes, and run `npm run build` before submitting. No test or lint scripts are currently defined in `package.json`.

## License

No license file is included in this repository, so reuse and redistribution terms have not been specified.
