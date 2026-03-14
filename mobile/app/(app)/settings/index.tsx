import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer, SectionHeader, ToggleItem } from "@/components/common";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSettingsStore } from "@/store/settingsStore";
import type { ThemeMode } from "@/types";

const themeModes: ThemeMode[] = ["light", "dark", "system"];

export default function SettingsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const compactMode = useSettingsStore((state) => state.compactMode);
  const setCompactMode = useSettingsStore((state) => state.setCompactMode);

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <SectionHeader
          title="Settings"
          subtitle="Workspace preferences"
          rightSlot={
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />

        <View style={styles.themeTabs}>
          {themeModes.map((mode) => {
            const active = themeMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setThemeMode(mode)}
                style={[
                  styles.themeBtn,
                  {
                    backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                    borderColor: active ? theme.colors.accent : theme.colors.border
                  }
                ]}
              >
                <Text style={{ color: active ? "#FFFFFF" : theme.colors.textSecondary, fontWeight: "600" }}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ToggleItem
          title="Compact Mode"
          description="Denser UI for power users on tablet and web."
          value={compactMode}
          onValueChange={setCompactMode}
        />

      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14
  },
  closeBtn: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  },
  themeTabs: {
    flexDirection: "row",
    gap: 10
  },
  themeBtn: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center"
  }
});
