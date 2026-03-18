import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Redirect, Stack } from "expo-router";
import { Platform } from "react-native";

import { useAuthStore } from "@/store/authStore";

const isIOS = Platform.OS === "ios";

const pushScreenOptions: NativeStackNavigationOptions = {
  presentation: "card",
  animation: isIOS ? "default" : "ios_from_right",
  animationDuration: 220,
  gestureEnabled: true,
  fullScreenGestureEnabled: isIOS,
  animationMatchesGesture: isIOS
};

const modalScreenOptions: NativeStackNavigationOptions = {
  presentation: "modal",
  animation: isIOS ? "default" : "fade_from_bottom",
  gestureEnabled: true
};

export default function AppLayout(): JSX.Element {
  const session = useAuthStore((state) => state.session);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ ...pushScreenOptions, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[chatId]" options={pushScreenOptions} />
      <Stack.Screen name="chat-info/[chatId]" options={pushScreenOptions} />
      <Stack.Screen name="new-message" options={modalScreenOptions} />
      <Stack.Screen name="media/[chatId]" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="profile/edit" options={modalScreenOptions} />
    </Stack>
  );
}
