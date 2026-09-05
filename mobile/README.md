# Qora Qarg'a (Expo + React Native + Web)

Internal messenger with shared Android + web codebase connected to the Python backend API and WebSocket gateway.

## Stack

- Expo + Expo Router
- React Native + React Native Web
- TypeScript (strict)
- Zustand (persisted state)
- React Hook Form + Zod
- TanStack Query provider
- Expo Image
- AsyncStorage persistence

## Backend

Production API: `https://messanger.cognilabs.org` — REST and the WebSocket share the one
domain, `wss://messanger.cognilabs.org/ws/chat?token=<jwt>`. These are the defaults in
`services/api/config.ts`; `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WS_BASE_URL` override
them. No localhost anywhere in the client.

The REST surface in `services/api/index.ts` covers every path the backend publishes,
including sessions, the change feed, pin/unpin, the pinned list, message search, delivery
receipts, per-conversation typing, `PATCH /users/me/status` and `/health`. Attachments go
to `/files/upload` as multipart with the field named `file`.

### Sessions and tokens

An access token lives 15 minutes; a rotating refresh token extends a device session for up
to 180 days. `services/api/session.ts` owns that lifecycle, and three rules from the
backend contract shape it:

- **One refresh at a time.** Two concurrent refreshes are read by the server as token
  reuse and revoke the whole session — verified against production.
- **A refresh token is single-use.** It is never retried, not even after a lost response,
  and the rotated replacement is stored before the new access token is released.
- **Only a definitive 401 signs the user out.** Network errors, 429 and 5xx leave the
  session intact; a 403 is an origin misconfiguration, not a reason to loop.

Startup order is refresh → `/users/me` → open socket, driven from `app/_layout.tsx`. The
refresh token lives in the Keychain / Keystore through `expo-secure-store`, never in
AsyncStorage; the access token is never persisted at all. Settings lists the account's
signed-in devices and can revoke one or all of them, and a socket closed with code `4001`
means this device was revoked — the app returns to sign-in instead of reconnecting.

On web the cookie flow is used only when the page is same-site with the API, because a
host-only cookie is not sent from any other origin; a cross-origin web build authenticates
as a device instead, so its session still survives a reload.

### Files

Uploads return `bucket` + `object_key` plus a signed URL that expires in about 15 minutes.
That URL is a lease, never an identity: `services/api/mediaUrls.ts` caches it and re-signs
through `GET /files/access` when a player reports failure, which is what an image or voice
message does after a chat has been open a while. A URL that still works is deliberately
never swapped, because replacing the source restarts playback.

### Recovery

Redis can drop an event while the socket is down. `GET /conversations/{id}/changes?after_id=`
replays creates, edits, deletes and pin changes since a stored cursor, and
`recoverConversationChanges` in the chat store applies each entry as an upsert — on open,
and for every conversation after a reconnect.

**CORS gates the browser build.** The backend keeps an origin allowlist:
`https://messanger.cognilabs.org` is accepted, anything else gets `400 Disallowed CORS
origin` on the preflight. Serving the web build from that same origin needs nothing; from
any other host the backend has to add it to the allowlist. Native builds are unaffected.

## Mock backend

The web build runs against an in-app mock — `services/api/mockBackend.ts` — rather than
the network, so the preview opens and works with nothing else running. Every typed API
wrapper already routes through `apiRequest`, so that one function is where the mock stands
in; the realtime socket reports connected without opening one, since there is no server to
reach. Sign-in accepts anything, and `features/auth/schemas.ts` relaxes its rules to match:
there is no account to get wrong. Signing in with a seeded address (`amir@company.uz`,
`nilufar@company.uz`, …) picks that person, which is how you swap the conversation
perspective.

The dataset is mutable for the life of the tab: messages you send, edits, reads, new
conversations and profile changes all stick, which is what makes the preview feel like the
app rather than a screenshot.

`EXPO_PUBLIC_USE_MOCK_API` controls it — unset it defaults to on for web and off for
native, so an EAS build still talks to the real API. Set it to `false` to point a web build
at the backend, or `true` to run the mock on a device.

## Run

1. Install dependencies:

```bash
cd mobile
npm install
```

2. Start development:

```bash
npm run start
```

3. Platform targets:

```bash
npm run android
npm run ios
npm run web
```

## Android APK / EAS

1. Authenticate and configure EAS:

```bash
npx eas login
```

2. Build preview APK:

```bash
npm run build:android:apk
```

3. Build production Android AAB:

```bash
npm run build:android:aab
```

4. Build iOS:

```bash
npm run build:ios
```

## Design system

Apple-style Liquid Glass, shared by mobile and web, in light and dark.

- `theme/colors.ts`: system colours, label/fill opacity tiers, separators, and the material
  stack (`materialUltraThin` -> `materialThick`) plus specular rim colours. The palette is
  warm neutral: the wallpaper is a warm room, but the panels themselves sit close to grey
  and only pick that warmth up through the blur — saturating the materials makes the whole
  UI read sepia. Blue is reserved for accents (own messages, badges, active glyphs) and
  selection is marked with a lighter neutral rather than a tint.
- `theme/typography.ts`: the iOS type ramp (largeTitle -> caption2), SF on Apple platforms
- `theme/tokens.ts`: spacing, continuous-corner radii, blur strength per material, layout widths, spring presets
- `theme/webStyles.ts`: injects the CSS `backdrop-filter` (blur + saturation + brightness) behind `dataSet={{ glass: ... }}`
- `components/ui/`: `GlassView`, `GlassBackdrop`, `AppText`, `ListSection`/`ListRow` (inset grouped lists),
  `IconButton`, `Chip`, `Badge`, `PressableScale`, `PresenceDot`, `GlassSwitch`, `NotificationHost`
- `components/layout/`: `AppShell` (nav rail + glass window), `WorkspaceSidebar`, `NavRail`,
  `WorkspacePane`, `DetailScreenShell`, `GlassTabBar` (floating capsule)

The material is layered like a real lens: a translucent tint that blurs whatever scrolls beneath
it, a diagonal specular sheen (`expo-linear-gradient` on native, a CSS gradient on web), a bright
rim on the top edge, and a darker refracted edge underneath.

Chrome floats above live content rather than boxing it in: navigation bars, the conversation
header, the composer, and the tab bar are glass capsules with the list scrolling under them, and
a bar's glass and compact title fade in with scroll (`FloatingTitleBar`). Panes themselves are
transparent, so the only glass is the window and the floating controls.

## Performance

The glass is cheap on purpose. A `backdrop-filter` costs the compositor roughly in
proportion to its radius across the whole element, every frame, so the rules are:

- **Nothing window-sized blurs.** `GlassView` takes `blurred={false}`, used by the desktop
  shell: the pane covers most of the viewport, and a smooth wallpaper has nothing in it
  worth softening. Measured, turning it off moves 0.1% of pixels.
- **`clear` means clear.** The base `[data-glass]` rule used to blur `clear` surfaces too,
  so both workspace panes paid for a filter that could not show.
- **The refracting rim is opt-in** (`refract`), because it is a second full-element
  composite pass to draw a five-pixel band. Only small controls get it.
- **The wallpaper blooms are gradients, not blurs.** They were `filter: blur(64px)` over
  roughly two viewports; a radial gradient looks the same and costs nothing.
- **Blur radii stay modest** (12/18/24/40). Past about 24px the picture behind is already
  unrecognisable, so the extra radius buys no legibility, only frame time.

Together that took the filtered area from 4.76M px² to 417K on a 1440×900 viewport, and
the worst frame during a scroll from 158ms to 73ms.

The conversation poll commits state only when something actually changed. It runs every
few seconds regardless, and handing React fresh object identities re-rendered the whole
list — cards, shadows and all — on a timer.

## Motion

Every transition is a spring, and the presets live in one place (`motion` and `transition` in
`theme/tokens.ts`) so screens, controls and notifications share the same physics.

**Screens.** `components/navigation/` holds the transition layer:

- `tabTransition.ts` — the tab navigator's `sceneStyleInterpolator`. React Navigation hands it a
  signed progress value (-1 left of the active tab, 0 active, 1 right), so the arriving scene
  slides in from the side you came from while the leaving one slides out the other way. Both
  settle up from 96.5%, which reads as the glass coming forward rather than cross-dissolving.
- `stackTransition.ts` — card interpolators for pushes and modals. Because every screen is
  transparent over one shared wallpaper, a full-width iOS slide would leave both screens legible
  at once; instead the arriving screen slides a third of the width in from the trailing edge while
  the one it covers parallaxes back and dissolves.
- `PlatformStack.tsx` / `PlatformStack.web.tsx` — the platform split. Native uses the platform
  stack, which already animates. The native stack's *web* implementation only toggles `display`,
  so every push landed as a hard cut; web swaps in `@react-navigation/stack`, which runs real card
  transitions and a drag-back gesture. Only the `.web` file imports it, so it never reaches the
  native bundle. Note that the JS stack defaults `animation` to `"none"` on web — naming a preset
  is what re-enables transitions at all.

**Lists.** `components/ui/RaisedCard.tsx` renders a row as a solid object rather than a
tinted stripe. What reads as depth is consistent lighting: a bright bevel along the top
edge where the face catches the light, a gradient falling off down the card, a shaded
underside, and two shadows — a tight contact shadow plus a wider soft one for the gap it
floats above. Hovering lifts it 2pt and lengthens the shadow; pressing sinks it and turns
the bevel inside out, moving the lit edge to the bottom the way a real button does. Used
by the chat list, directory and call history, which no longer need hairline separators.
Note the two nested views: a shadow and `overflow: hidden` cannot share one view on
native, so the outer casts and the inner clips.

**Call audio.** A call with no sound feedback feels broken: you tap dial and nothing
tells you the far end is ringing. `features/calls/services/callTones.ts` synthesises the
four cues with Web Audio for the browser — 425Hz ringback on a 1s/2.2s cycle, a 440+480Hz
double-burst ringtone, and short rising/falling blips on connect and hang-up — while
`callTones.native.ts` hands the same calls to the platform's own telephony tones through
InCallManager, so the device's ringtone choice, silent switch and vibration are respected.
`useCallTones` drives them from the call status and is mounted once, at the root; a second
mount would play everything twice. Note that answering lands on `connecting`, not
`connected`, so that is where ringing has to stop.

Hold is a real control rather than a label: it disables every outgoing track and stops
playing what arrives, while leaving the peer connection up so the call resumes without
renegotiating. Releasing restores the camera only if it was on beforehand.

`react-native-incall-manager` is what makes speaker routing real on device: the adapter
claims the audio session when a call starts (loudspeaker for video, earpiece for audio),
releases it on cleanup, and reports `canRouteAudio`. The dock comes up as soon as the call is yours to run, which includes while it is still
dialling — putting an outgoing call on speaker before it is answered is normal. An inbound
ring is the exception: that screen stays Accept and Decline only. Camera and flip appear
for video calls; mute, speaker and hold are there for both. Mute, hold and the camera
controls stay inert until the local tracks exist rather than throwing at whoever taps
first, and the fader scales the ringback too, so it is not a dead control before anyone
answers.

The full dock — speaker, hold, mute, camera, flip — is shown on every platform. Routing
is only meaningful on device, where there is an earpiece to route away from; in a browser
the speaker button is UI state and the level fader is what actually changes what you hear.

**Calls and media messages.** `components/ui/VolumeSlider.tsx` is the in-call output
level, dragged like a fader. It is plumbed through the WebRTC adapter as `outputVolume`
plus a `canSetVolume` capability flag: the browser applies the gain to the media element
that plays the remote audio, while native reports it unsupported, because
react-native-webrtc exposes no gain on a remote track and InCallManager has no volume
API — routing to the loudspeaker is the loudness control on device. The dock puts the
level first, secondary controls next, and hanging up on its own row so it is never a
neighbour of mute. A video note is a free-standing circle rather than a bubble, with
playback progress running around its rim — note the `videoStyle` prop, without which
expo-av leaves the inner `<video>` at its natural size on web and the circle shows that
frame's top-left corner instead of a centred crop; a voice message fills its waveform up to the
playhead and scales the bar under it.

**Composer.** `components/chat/ChatComposer.tsx` follows Telegram's shape: one row of
`emoji · input · attach · action`, where a single button on the right carries the whole
right-hand side. It sends while there is text and is the recorder while there is not —
**hold to record, release to finish, tap to swap voice for video note**. While recording,
the text field is replaced by a live indicator and the paperclip becomes a discard button.

The gesture continues after the hold: sliding **left** past 90pt throws the take away,
sliding **up** past 64pt locks it hands-free (the finger can go, and explicit send and
discard buttons take over), and simply lifting sends. A hint follows the finger while
sliding. Both recorders behave the same way.

While filming, `VideoNoteViewfinder` fills a 232pt round frame above the bar — the same
shape the note will be sent in, big enough to actually frame yourself in — with rotate,
pause and, where the camera reports one, a torch stacked beside it.

Turning the camera around needs the recorder decoupled from it: `MediaRecorder` binds to
the tracks it was handed and cannot swap them, so recording the camera directly would make
a mid-take flip impossible without losing everything recorded so far. The web service
instead draws whichever camera is live into a square canvas and records `captureStream()`
from that, keeping the original microphone track. Flipping is then only a change of what
gets drawn — the recording never notices, and the picture stops being mirrored once it is
the rear camera. That row is absolutely positioned rather than stacked: growing the dock
pushed the composer row past the bottom of the pane, and the dock had to stop clipping for
the viewfinder to be visible at all. On native the video note is captured by the system
camera UI, which owns its own preview, pause and torch, so `mediaRecorder.native.ts`
reports those unsupported and the controls are hidden rather than faked.

That button is a `PanResponder`, not a `Pressable`, for two reasons found the hard way:
react-native-web releases a press a few milliseconds after `onLongPress` fires, so
`onPressOut` arrives while the finger is still down and cannot mean "let go"; and starting
a recording re-renders the row, which makes the responder system try to hand the gesture
away mid-hold — hence `onPanResponderTerminationRequest: () => false`. The recorder hooks
also take a ticket per `start()`, so a hold released before the device finished opening
releases it instead of announcing itself as recording a moment later.
`MediaMessageComposerActions` is now only the draft preview that lets you hear a
recording back before sending it; the labelled Voice / Video note chips it used to show
above the field are what the inline button replaced.

**Notifications.** `components/ui/NotificationHost.tsx` with `store/notificationStore.ts`
(`useAppToast` is the call site API). A card drops in from above on a spring, overshooting
slightly so it lands rather than slides to a stop, and stacks up to three deep with older cards
sinking behind. Swiping up hands it to the finger: it tracks the drag, thins and shrinks as it
climbs, and either flies out the top or springs back. Pulling down is rubber-banded, and the
auto-hide countdown pauses for as long as a card is held.

## Responsive layout

`hooks/useResponsive.ts` drives every layout decision:

- `< 768px`: single pane with the floating glass tab bar
- `768–1079px`: single pane, wider gutters
- `>= 1080px`: desktop shell - nav rail, workspace sidebar, list pane, detail pane

The web build uses the full viewport (no mobile-width frame); the same components render the
desktop shell on wide screens and the phone layout on narrow ones.

## Architecture

- `app/`: Expo Router navigation and screens
- `components/`: Reusable UI primitives and chat components
- `features/`: Feature-specific logic and selectors
- `store/`: Zustand stores (auth, chats, settings)
- `types/`: Strict domain types
- `theme/`: Centralized enterprise design tokens
- `services/api`: Backend REST client and adapters
- `services/realtime`: WebSocket client
- `utils/`: IDs, date formatting, message helpers

## Environment

Set API endpoints with Expo public env vars:

- `EXPO_PUBLIC_API_BASE_URL` (for example `http://localhost:8000`)
- `EXPO_PUBLIC_WS_BASE_URL` (for example `ws://localhost:8001`)
- `EXPO_PUBLIC_USE_LOCAL_MEDIA_UPLOAD` (`true` by default)
