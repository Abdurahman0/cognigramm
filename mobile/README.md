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
  `IconButton`, `Chip`, `Badge`, `PressableScale`, `PresenceDot`, themed toasts
- `components/layout/`: `AppShell` (nav rail + glass window), `WorkspaceSidebar`, `NavRail`,
  `WorkspacePane`, `DetailScreenShell`, `GlassTabBar` (floating capsule)

Real backdrop blur is CSS-only, so native platforms fall back to layered translucency over the
same wallpaper. Controls are capsules, cards use large continuous radii, and presses spring.

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
