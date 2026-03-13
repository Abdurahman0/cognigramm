import "react-native-reanimated";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore, useChatStore, useSettingsStore } from "@/store";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout(): JSX.Element {
  const [queryClient] = useState(() => new QueryClient());
  const { theme } = useAppTheme();
  const authHydrated = useAuthStore((state) => state.hydrated);
  const chatHydrated = useChatStore((state) => state.hydrated);
  const settingsHydrated = useSettingsStore((state) => state.hydrated);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme.colors.background]);

  useEffect(() => {
    if (authHydrated && chatHydrated && settingsHydrated) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [authHydrated, chatHydrated, settingsHydrated]);

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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <Toast position="top" topOffset={52} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
