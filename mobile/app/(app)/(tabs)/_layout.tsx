import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/useAppTheme";

export default function TabsLayout(): JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: "fade",
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        sceneStyle: {
          backgroundColor: theme.colors.background
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 52 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom - 2, 8)
        },
        tabBarItemStyle: {
          marginTop: -2
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600"
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "chats"
              ? "message-square"
              : route.name === "contacts"
              ? "users"
              : route.name === "calls"
              ? "phone"
              : route.name === "status"
              ? "activity"
              : "user";
          return <Feather name={iconName} size={size} color={color} />;
        }
      })}
    >
      <Tabs.Screen name="chats" options={{ title: "Chats" }} />
      <Tabs.Screen name="contacts" options={{ title: "Directory" }} />
      <Tabs.Screen name="calls" options={{ title: "Calls" }} />
      <Tabs.Screen name="status" options={{ title: "Status" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
