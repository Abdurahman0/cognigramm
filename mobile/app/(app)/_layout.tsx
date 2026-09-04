import { Redirect } from "expo-router";

import { PlatformStack, modalTransition, pushTransition } from "@/components/navigation";
import { useAuthStore } from "@/store/authStore";

export default function AppLayout(): JSX.Element {
  const session = useAuthStore((state) => state.session);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <PlatformStack
      screenOptions={{
        ...pushTransition,
        headerShown: false
      }}
    >
      <PlatformStack.Screen name="(tabs)" />
      <PlatformStack.Screen name="chat/[chatId]" options={pushTransition} />
      <PlatformStack.Screen name="chat-info/[chatId]" options={pushTransition} />
      <PlatformStack.Screen name="calls/[callId]" options={pushTransition} />
      <PlatformStack.Screen name="new-message" options={modalTransition} />
      <PlatformStack.Screen name="resources/[chatId]" options={pushTransition} />
      <PlatformStack.Screen name="settings/index" />
      <PlatformStack.Screen name="profile/edit" options={modalTransition} />
    </PlatformStack>
  );
}
