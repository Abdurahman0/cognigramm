import { Tabs } from "expo-router";
import { useMemo } from "react";

import { AppShell, GlassTabBar } from "@/components/layout";
import { createGlassTabSceneInterpolator, glassTabTransitionSpec } from "@/components/navigation";
import { useResponsive } from "@/hooks/useResponsive";

export default function TabsLayout(): JSX.Element {
  const { isDesktop, width } = useResponsive();
  // The scenes slide by a distance measured from the viewport, so the interpolator is
  // rebuilt when the window resizes rather than baking in a fixed number.
  const sceneStyleInterpolator = useMemo(() => createGlassTabSceneInterpolator(width), [width]);

  return (
    <AppShell>
      <Tabs
        tabBar={(props) => (isDesktop ? null : <GlassTabBar {...props} />)}
        screenOptions={{
          headerShown: false,
          sceneStyleInterpolator,
          transitionSpec: glassTabTransitionSpec,
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
