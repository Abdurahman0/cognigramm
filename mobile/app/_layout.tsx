import "react-native-reanimated";

import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { GlassBackdrop, NotificationHost } from "@/components/ui";
import { IncomingCallPrompt } from "@/features/calls/components/IncomingCallPrompt";
import { useCallTones } from "@/features/calls/hooks/useCallTones";
import { useAppTheme } from "@/hooks/useAppTheme";
import { scheduleProactiveRefresh } from "@/services/api/session";
import { setUnauthorizedHandler } from "@/services/api/unauthorizedHandler";
import { useAuthStore, useCallsStore, useChatStore, useSettingsStore } from "@/store";
import { injectWebThemeStyles } from "@/theme/webStyles";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Navigators paint their own opaque background by default, which would cover the
 * glass backdrop, so every navigation surface is transparent instead.
 */
const createNavigationTheme = (
  isDark: boolean,
  accent: string,
  textPrimary: string,
  border: string
): Theme => {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: accent,
      background: "transparent",
      card: "transparent",
      text: textPrimary,
      border
    }
  };
};

export default function RootLayout(): JSX.Element {
  const [queryClient] = useState(() => new QueryClient());
  const { theme } = useAppTheme();
  const router = useRouter();
  const authHydrated = useAuthStore((state) => state.hydrated);
  const session = useAuthStore((state) => state.session);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const chatHydrated = useChatStore((state) => state.hydrated);
  const initializeChats = useChatStore((state) => state.initializeForSession);
  const initializeCalls = useCallsStore((state) => state.initializeForSession);
  const settingsHydrated = useSettingsStore((state) => state.hydrated);

  // Ringback, ringtone and the connect/end blips, driven by the active call. This is the
  // only mount, because a second one would play every tone twice.
  useCallTones();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.backdropBase).catch(() => undefined);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.backgroundColor = theme.colors.backdropBase;
    }
  }, [theme.colors.backdropBase]);

  useEffect(() => {
    injectWebThemeStyles(theme);
  }, [theme]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      const state = useAuthStore.getState();
      if (state.session) {
        state.logout();
      }
      router.replace("/(auth)/login");
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [router]);

  useEffect(() => {
    if (authHydrated && chatHydrated && settingsHydrated) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [authHydrated, chatHydrated, settingsHydrated]);

  // Startup order: exchange the stored refresh token for an access token
  // before anything asks for data or opens a socket. An access token does not
  // survive a restart, so without this every launch would look signed out.
  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    restoreSession().catch(() => undefined);
  }, [authHydrated, restoreSession]);

  // Keep the token ahead of its 15-minute expiry while the app is open.
  useEffect(() => {
    if (!session) {
      return;
    }
    return scheduleProactiveRefresh();
  }, [session?.userId]);

  // Keyed on the user, not the token: the token rotates every quarter of an
  // hour, and re-initialising the whole chat store that often would be absurd.
  useEffect(() => {
    if (!authHydrated || !chatHydrated) {
      return;
    }
    initializeChats().catch(() => undefined);
  }, [authHydrated, chatHydrated, initializeChats, session?.userId]);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    initializeCalls().catch(() => undefined);
  }, [authHydrated, initializeCalls, session?.userId]);

  const navigationTheme = createNavigationTheme(
    theme.mode === "dark",
    theme.colors.accent,
    theme.colors.textPrimary,
    theme.colors.glassBorder
  );

  const ready = authHydrated && chatHydrated && settingsHydrated;

  if (!ready) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <GlassBackdrop />
        <View style={styles.splash}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <GlassBackdrop />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
          <View style={styles.appFrame}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "transparent" }
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
            </Stack>
            <IncomingCallPrompt />
            <NotificationHost />
          </View>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "transparent",
    flex: 1
  },
  splash: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  appFrame: {
    backgroundColor: "transparent",
    flex: 1
  }
});
