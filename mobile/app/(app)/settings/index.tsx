import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppButton, SectionHeader, ToggleItem } from "@/components/common";
import { DetailScreenShell } from "@/components/layout";
import { Chip, GlassView, IconButton } from "@/components/ui";
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
    <DetailScreenShell maxWidth={720}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader
          title="Settings"
          subtitle="Workspace preferences"
          rightSlot={
            <IconButton icon="x" accessibilityLabel="Close settings" tone="plain" onPress={() => router.back()} />
          }
        />

        <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Appearance</Text>
          <Text style={[styles.cardHint, { color: theme.colors.textMuted }]}>
            Glass surfaces adapt to the selected mode across mobile and web.
          </Text>
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
        </GlassView>

        <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Layout</Text>
          <ToggleItem
            title="Compact density"
            description="Tighter conversation rows for power users on tablet and web."
            value={compactMode}
            onValueChange={setCompactMode}
          />
        </GlassView>

        <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Realtime</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: connectionLive ? theme.colors.online : theme.colors.warning }
              ]}
            />
            <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>
              Message socket · {CONNECTION_LABELS[websocketStatus] ?? websocketStatus}
            </Text>
          </View>
        </GlassView>

        <View style={styles.signOutRow}>
          <AppButton
            variant="danger"
            label="Sign out"
            fullWidth={false}
            icon={<Feather name="log-out" size={15} color={theme.colors.onAccent} />}
            onPress={() => {
              logout();
              router.replace("/(auth)/login");
            }}
          />
        </View>
      </ScrollView>
    </DetailScreenShell>
  );
}

const styles = StyleSheet.create({
  signOutRow: {
    alignItems: "flex-start",
    paddingTop: 2
  },
  content: {
    gap: 12,
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 14
  },
  card: {
    gap: 10,
    padding: 18
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700"
  },
  cardHint: {
    fontSize: 12,
    lineHeight: 17
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 34
  },
  statusDot: {
    borderRadius: 999,
    height: 9,
    width: 9
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "600"
  }
});
