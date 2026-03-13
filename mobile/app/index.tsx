import { Redirect } from "expo-router";

import { useAuthStore } from "@/store/authStore";

export default function IndexRoute(): JSX.Element {
  const hasSeenOnboarding = useAuthStore((state) => state.hasSeenOnboarding);
  const session = useAuthStore((state) => state.session);

  if (!hasSeenOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(app)/(tabs)/chats" />;
}
