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
  stack (`materialUltraThin` -> `materialThick`) plus specular rim colours
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
playback progress running around its rim; a voice message fills its waveform up to the
playhead and scales the bar under it.

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
