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

## What it does

Chats with history, search, replies, edits, deletes, pins and **forwarding**;
image and file attachments; **voice messages** with a recorded waveform;
typing indicators, presence and read receipts; audio and video calls; the
account's **signed-in devices**, with per-device revocation.

## Getting started

```bash
pnpm install
pnpm desktop      # the real thing: Tauri window + hot reload
pnpm dev          # renderer only, in a browser at http://localhost:1420
```

Use `pnpm desktop` for anything that talks to the backend. `pnpm dev` runs the
same renderer in a plain browser, where the dev origin is not on the server's
CORS allowlist — good for UI work and the stubbed E2E suite, not for signing in.

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
  api/        wire types, HTTP client, session/tokens, endpoints, adapters,
              message cache, change feed, signed-media leases
  realtime/   the chat socket, its typed event map, and the provider that
              turns server events into cache writes and store updates
  stores/     Zustand: auth, chat runtime, calls, UI preferences
  features/   auth · conversations · chat · contacts · calls · settings
  components/ ui primitives (shadcn conventions) and window chrome
  hooks/      query hooks, typing signal, media URLs, theme, debounce
  lib/        config, formatting, secure store, Tauri bridges
```

Four rules hold the data flow together:

1. **The socket is the live path.** REST fills the first screen and patches
   gaps after a reconnect; everything after that arrives as a WebSocket event.
   Queries do not poll on window focus.
2. **One writer per transcript.** Every append, edit and delivery change goes
   through `src/api/message-cache.ts`, which de-duplicates by id and
   `client_message_id` and refuses to walk delivery ticks backwards.
3. **Wire types never reach a component.** `src/api/adapters.ts` is the only
   place that knows the backend speaks snake_case.
4. **Nothing is assumed delivered.** What the socket missed is replayed from
   the change feed (below) rather than hoped for.

### Sessions and tokens

An access token lives 15 minutes; a rotating refresh token extends a device
session for up to 180 days. `src/api/session.ts` owns that lifecycle, and three
rules from the backend contract shape it:

- **One refresh at a time**, in-process *and* across tabs (`navigator.locks`).
  Two concurrent refreshes are read by the server as token reuse and revoke the
  whole session — verified against production.
- **A refresh token is single-use.** It is never retried, not even after a lost
  response, and the rotated replacement is persisted before the new access
  token is released to waiting requests.
- **Only a definitive 401 signs the user out.** Network errors, 429 and 5xx
  leave the session intact; a 403 is an origin misconfiguration and does not
  loop.

Startup order is refresh → `/users/me` → open socket. The refresh token is kept
by a Rust command in the app's private data directory (owner-only on Unix), not
in `localStorage`; a browser dev build falls back to `localStorage`, which is
acceptable only because that build talks to stubs. Settings → Devices lists
every signed-in device and can revoke one or all of them; a socket closed with
code `4001` means the device was revoked, and returns the window to the login
screen instead of reconnecting forever.

### Files

Uploads go to `POST /files/upload`, which stores the object in S3 and returns
`bucket` + `object_key` plus a **signed URL that expires in 15 minutes**. That
URL is a lease, never an identity: only the key is persisted, and
`src/api/media-urls.ts` re-signs through `GET /files/access` when a lease runs
out — which in practice is what a media element reports through `onError`
after a window has been open a while. A URL that still works is deliberately
never swapped, because replacing `src` restarts a playing voice message.

Voice messages carry client-derived `metadata_json` — duration, waveform,
codec — because the backend stores bytes and derives nothing from them.

### Recovery

Redis can drop an event while the socket is down. `GET /conversations/{id}/changes?after_id=`
replays creates, edits, deletes and pin changes since a stored cursor;
`src/api/change-feed.ts` applies each entry as an upsert (entries carry current
state, so order does not matter), persists the cursor per conversation, and
runs on open, on every reconnect, and on a timer while a conversation is
focused.

### Why the HTTP plugin

A Tauri webview's origin is `tauri://localhost`, which the backend's CORS
allowlist does not contain. `src/api/transport.ts` therefore issues requests
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

- Group calls show as one-to-one: the engine holds a single peer connection.
- No TURN server, as above.
- Video notes (round video) are a mobile feature and are rendered, not recorded.
- `POST /files/presign` (direct-to-S3 upload) is wired in `filesApi` but unused;
  the backend upload needs no bucket CORS and is the recommended path.
