import { Redirect, Stack } from "expo-router";
import { Platform } from "react-native";

import { useAuthStore } from "@/store/authStore";

export default function AuthLayout(): JSX.Element {
  const session = useAuthStore((state) => state.session);
  const hasSeenOnboarding = useAuthStore((state) => state.hasSeenOnboarding);

  if (session && hasSeenOnboarding) {
    return <Redirect href="/(app)/(tabs)/chats" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === "ios" ? "default" : "ios_from_right",
        animationDuration: 200,
        gestureEnabled: true
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
