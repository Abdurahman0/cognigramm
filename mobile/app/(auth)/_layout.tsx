import { Redirect } from "expo-router";

import { PlatformStack, pushTransition } from "@/components/navigation";
import { useAuthStore } from "@/store/authStore";

export default function AuthLayout(): JSX.Element {
  const session = useAuthStore((state) => state.session);

  if (session) {
    return <Redirect href="/(app)/(tabs)/chats" />;
  }

  return (
    <PlatformStack
      screenOptions={{
        ...pushTransition,
        headerShown: false
      }}
    >
      <PlatformStack.Screen name="login" />
      <PlatformStack.Screen name="register" />
    </PlatformStack>
  );
}
