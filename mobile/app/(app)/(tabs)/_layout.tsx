import { Tabs } from "expo-router";

import { AppShell, GlassTabBar } from "@/components/layout";
import { useResponsive } from "@/hooks/useResponsive";

export default function TabsLayout(): JSX.Element {
  const { isDesktop } = useResponsive();

  return (
    <AppShell>
      <Tabs
        tabBar={(props) => (isDesktop ? null : <GlassTabBar {...props} />)}
        screenOptions={{
          headerShown: false,
          animation: "fade",
          sceneStyle: {
            backgroundColor: "transparent"
          }
        }}
      >
        <Tabs.Screen name="chats" options={{ title: "Chats" }} />
        <Tabs.Screen name="contacts" options={{ title: "Directory" }} />
        <Tabs.Screen name="calls" options={{ title: "Calls" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </AppShell>
  );
}
