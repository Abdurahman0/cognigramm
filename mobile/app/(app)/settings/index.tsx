import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { AppButton, SectionHeader, ToggleItem } from "@/components/common";
import { DetailScreenShell } from "@/components/layout";
import { AppText, Chip, IconButton, ListRow, ListSection, PresenceDot } from "@/components/ui";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ThemeMode } from "@/types";

const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" }
];

const CONNECTION_LABELS: Record<string, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Offline"
};

export default function SettingsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const compactMode = useSettingsStore((state) => state.compactMode);
  const setCompactMode = useSettingsStore((state) => state.setCompactMode);
  const websocketStatus = useChatStore((state) => state.websocketStatus);
  const logout = useAuthStore((state) => state.logout);

  const connectionLive = websocketStatus === "connected";

  return (
    <DetailScreenShell maxWidth={680}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader
          title="Settings"
          subtitle="Workspace preferences"
          rightSlot={
            <IconButton icon="x" accessibilityLabel="Close settings" tone="plain" onPress={() => router.back()} />
          }
        />

        <ListSection header="Appearance" footer="Liquid Glass surfaces pick up the wallpaper behind them in both appearances.">
          <View style={styles.chipRow}>
            {THEME_MODES.map((mode) => (
              <Chip
                key={mode.key}
                label={mode.label}
                active={themeMode === mode.key}
                onPress={() => setThemeMode(mode.key)}
              />
            ))}
          </View>
          <ToggleItem
            title="Compact density"
            description="Tighter conversation rows for tablet and web."
            value={compactMode}
            onValueChange={setCompactMode}
          />
        </ListSection>

        <ListSection header="Realtime">
          <ListRow
            title="Message socket"
            value={CONNECTION_LABELS[websocketStatus] ?? websocketStatus}
            showChevron={false}
            leading={
              <View style={styles.statusDot}>
                <PresenceDot online={connectionLive} size={10} ringColor="transparent" />
              </View>
            }
          />
        </ListSection>

        <View style={styles.signOutRow}>
          <AppButton
            variant="danger"
            label="Sign out"
            fullWidth={false}
            icon={<Feather name="log-out" size={16} color={theme.colors.onAccent} />}
            onPress={() => {
              logout();
              router.replace("/(auth)/login");
            }}
          />
        </View>

        <AppText variant="caption1" tone="tertiary" style={styles.version}>
          Qora Qarg&apos;a · Workspace messenger
        </AppText>
      </ScrollView>
    </DetailScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  statusDot: {
    alignItems: "center",
    justifyContent: "center",
    width: 22
  },
  signOutRow: {
    alignItems: "flex-start"
  },
  version: {
    textAlign: "center"
  }
});
