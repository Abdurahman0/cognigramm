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
