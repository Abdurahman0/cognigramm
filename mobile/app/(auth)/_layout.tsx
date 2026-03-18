import { Redirect, Stack } from "expo-router";
import { Platform } from "react-native";

import { useAuthStore } from "@/store/authStore";

export default function AuthLayout(): JSX.Element {
  const session = useAuthStore((state) => state.session);

  if (session) {
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
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
