import "react-native-reanimated";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";

import { useAppTheme } from "@/hooks/useAppTheme";
import { setUnauthorizedHandler } from "@/services/api/unauthorizedHandler";
import { useAuthStore, useChatStore, useSettingsStore } from "@/store";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout(): JSX.Element {
  const [queryClient] = useState(() => new QueryClient());
  const { theme } = useAppTheme();
  const router = useRouter();
  const authHydrated = useAuthStore((state) => state.hydrated);
  const session = useAuthStore((state) => state.session);
  const chatHydrated = useChatStore((state) => state.hydrated);
  const initializeChats = useChatStore((state) => state.initializeForSession);
  const settingsHydrated = useSettingsStore((state) => state.hydrated);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.body.style.backgroundColor = theme.colors.background;
    }
  }, [theme.colors.background]);

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

  useEffect(() => {
    if (!authHydrated || !chatHydrated) {
      return;
    }
    initializeChats().catch(() => undefined);
  }, [authHydrated, chatHydrated, initializeChats, session?.token]);

  const ready = authHydrated && chatHydrated && settingsHydrated;

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <View style={[styles.appFrame, Platform.OS === "web" && styles.webFrame]}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
          <Toast position="top" topOffset={52} />
        </View>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  appFrame: {
    flex: 1
  },
  webFrame: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 480
  }
});
