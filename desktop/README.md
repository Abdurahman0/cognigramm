# Qora Qarg'a — Desktop

Cross-platform desktop client for the Qora Qarg'a messenger. One codebase ships
Windows, macOS and Linux binaries; the FastAPI backend is untouched.

```
React + TypeScript  ──►  Tauri 2 (Rust)  ──►  .exe / .msi · .app / .dmg · .deb / .rpm / AppImage
        │
        └── HTTPS + WSS ──►  https://messanger.cognilabs.org
```

## Stack

| Layer | Choice |
| --- | --- |
| Desktop runtime | Tauri 2 (Rust) |
| UI | React 19 + TypeScript (strict) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui conventions on Radix primitives |
| Client state | Zustand (persisted) |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod |
| Icons | Lucide |
| Realtime | Native WebSocket, typed event map |
| Calls | WebRTC (`RTCPeerConnection`) over the backend's signalling |
| Tests | Vitest (unit) + Playwright (E2E) |
| Quality | ESLint + Prettier |
| Packages | pnpm |

## Getting started

```bash
pnpm install
pnpm dev          # renderer only, in a browser at http://localhost:1420
pnpm desktop      # the real thing: Tauri window + hot reload
```

`pnpm desktop` needs a Rust toolchain and the platform's webview headers:

- **All platforms** — [rustup](https://rustup.rs)
- **Linux** — `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf build-essential curl wget file libssl-dev libxdo-dev libgtk-3-dev`
- **macOS** — Xcode Command Line Tools
- **Windows** — MSVC build tools + WebView2 (preinstalled on Windows 11)

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server (browser) |
| `pnpm desktop` | `tauri dev` — native window, hot reload |
| `pnpm build` | Typecheck, then build the renderer to `dist/` |
| `pnpm desktop:build` | Full platform bundle into `src-tauri/target/release/bundle/` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm test` | Vitest unit suite |
| `pnpm test:e2e` | Playwright, against the dev server with a stubbed API |

## Configuration

`.env` (see `.env.example`) — both keys default to production, so a build with
no env file still points at the real backend:

```
VITE_API_BASE_URL=https://messanger.cognilabs.org
VITE_WS_BASE_URL=wss://messanger.cognilabs.org
```

There is no localhost fallback anywhere in the client.

## Architecture

```
src/
  api/        wire types, HTTP client, endpoints, wire→domain adapters, message cache
  realtime/   the chat socket, its typed event map, and the provider that
              turns server events into cache writes and store updates
  stores/     Zustand: auth (persisted), chat runtime, calls, UI preferences
  features/   auth · conversations · chat · contacts · calls · settings
  components/ ui primitives (shadcn conventions) and window chrome
  hooks/      query hooks, typing signal, theme, debounce
  lib/        config, formatting, Tauri bridges (window, notifications)
```

Three rules hold the data flow together:

1. **The socket is the live path.** REST fills the first screen and patches
   gaps after a reconnect; everything after that arrives as a WebSocket event.
   Queries do not poll on window focus.
2. **One writer per transcript.** Every append, edit and delivery change goes
   through `src/api/message-cache.ts`, which de-duplicates by `client_message_id`
   and refuses to walk delivery ticks backwards.
3. **Wire types never reach a component.** `src/api/adapters.ts` is the only
   place that knows the backend speaks snake_case.

### Why the HTTP plugin

A Tauri webview's origin is `tauri://localhost`, which the backend's CORS
allowlist does not contain. `src/api/client.ts` therefore issues requests
through `@tauri-apps/plugin-http`, which performs them in Rust where CORS does
not apply. In a plain browser the same code falls back to `window.fetch`. The
desktop app never needs the server to allowlist a client origin.

### Calls

`features/calls/call-engine.ts` is a module singleton, not a hook: an incoming
call has to be answerable from any screen, and the peer connection must survive
route changes. Signalling follows the backend contract — `call_invite` →
`call_accepted` → SDP offer/answer → ICE — and the caller only offers once the
callee has picked up, so no media flows while a phone is still ringing.

ICE uses public STUN. A symmetric-NAT pair needs TURN; credentials go in
`ICE_SERVERS` in `features/calls/webrtc.ts`.

## Design and performance

The look is the mobile client's warm-neutral Liquid Glass, ported to CSS
variables in `src/index.css` — the same palette, materials and travelling
selection lens.

One rule is load-bearing: **`backdrop-filter` costs the compositor roughly
radius × area.** Large panels here are translucent fills over a gradient
wallpaper (`.glass-panel`), and a real blur is reserved for small floating
chrome (`.glass-floating`) where varied content actually passes underneath.
Blur radii stay at or under 24px — past that the backdrop is unrecognisable
anyway, so the extra radius buys frame time and nothing else.

## Desktop behaviour

- Frameless window with a custom title bar; the strip is a drag region.
- Closing hides to the tray — a messenger that stops receiving when its window
  is dismissed is one people miss calls on. Quit lives in the tray menu.
- A second launch focuses the running window instead of opening a second
  socket session.
- Notifications go through the OS notification centre, and only fire when the
  message is not already visible on screen.

## Known limits

- The backend issues an access token with no refresh endpoint, so a 401
  signs the user out. `setAuthToken` in `src/api/client.ts` is where a refresh
  flow would slot in.
- Group calls show as one-to-one: the engine holds a single peer connection.
- No TURN server, as above.
