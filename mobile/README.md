# Company Messenger (Expo + React Native + Web)

Premium internal company messenger scaffold with shared mobile/web codebase and fully local demo logic.

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

## Architecture

- `app/`: Expo Router navigation and screens
- `components/`: Reusable UI primitives and chat components
- `features/`: Feature-specific logic and selectors
- `store/`: Zustand stores (auth, chats, settings)
- `mock/`: Shared business mock data
- `types/`: Strict domain types
- `theme/`: Centralized enterprise design tokens
- `services/`: Mock async services for auth and demo flows
- `utils/`: IDs, date formatting, message helpers

## Demo credentials

- Email: `amina.rahimova@company.local`
- Password: `123456`
- OTP code: `123456`
