import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, Avatar, SectionHeader, ToggleItem } from "@/components/common";
import { WorkspacePane } from "@/components/layout";
import { Chip, GlassView, IconButton } from "@/components/ui";
import { PRESENCE_LABELS } from "@/constants/chat";
import { ROLE_LABELS } from "@/constants/roles";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useResponsive } from "@/hooks/useResponsive";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { ThemeMode } from "@/types";

const THEME_MODES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" }
];

export default function ProfileScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();
  const user = useCurrentUser();
  const logout = useAuthStore((state) => state.logout);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const compactMode = useSettingsStore((state) => state.compactMode);
  const setCompactMode = useSettingsStore((state) => state.setCompactMode);

  const detailRows: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; value: string }[] = [
    { icon: "mail", label: "Work email", value: user.email },
    { icon: "phone", label: "Phone", value: user.phone ?? "Not set" },
    { icon: "briefcase", label: "Department", value: user.department },
    { icon: "map-pin", label: "Location", value: user.officeLocation ?? "Not set" },
    { icon: "clock", label: "Timezone", value: user.timezone }
  ];

  const content = (
    <ScrollView
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title="Profile"
        subtitle="Your workspace account"
        rightSlot={
          <View style={styles.headerActions}>
            <IconButton
              icon="edit-2"
              accessibilityLabel="Edit profile"
              onPress={() => router.push("/(app)/profile/edit")}
            />
            <IconButton
              icon="settings"
              accessibilityLabel="Open settings"
              onPress={() => router.push("/(app)/settings" as never)}
            />
          </View>
        }
      />

      <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.hero}>
        <Avatar
          uri={user.avatar}
          name={user.fullName}
          size={92}
          shape="squircle"
          showOnlineDot
          isOnline={user.isOnline}
        />
        <View style={styles.heroCopy}>
          <Text style={[styles.heroName, { color: theme.colors.textPrimary }]}>{user.fullName}</Text>
          <Text style={[styles.heroRole, { color: theme.colors.textSecondary }]}>
            {ROLE_LABELS[user.role]} · {user.title}
          </Text>
          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: theme.colors.glassSoft }]}>
              <Text style={[styles.badgeLabel, { color: theme.colors.textSecondary }]}>{user.department}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.colors.accentMuted }]}>
              <Text style={[styles.badgeLabel, { color: theme.colors.accent }]}>
                {PRESENCE_LABELS[user.presence]}
              </Text>
            </View>
          </View>
        </View>
      </GlassView>

      {user.about ? (
        <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>About</Text>
          <Text style={[styles.cardBody, { color: theme.colors.textSecondary }]}>{user.about}</Text>
        </GlassView>
      ) : null}

      <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Account</Text>
        {detailRows.map((row) => (
          <View key={row.label} style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: theme.colors.glassSoft }]}>
              <Feather name={row.icon} size={14} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.detailLabel, { color: theme.colors.textMuted }]}>{row.label}</Text>
            <Text numberOfLines={1} style={[styles.detailValue, { color: theme.colors.textPrimary }]}>
              {row.value}
            </Text>
          </View>
        ))}
      </GlassView>

      <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Appearance</Text>
        <View style={styles.themeRow}>
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
          description="Tighter rows for dense desktop workflows."
          value={compactMode}
          onValueChange={setCompactMode}
        />
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
  );

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        <WorkspacePane style={styles.desktopPane}>{content}</WorkspacePane>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.mobileRoot}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mobileRoot: {
    backgroundColor: "transparent",
    flex: 1
  },
  desktopRoot: {
    backgroundColor: "transparent",
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    minWidth: 0
  },
  desktopPane: {
    maxWidth: 780,
    width: "100%"
  },
  signOutRow: {
    alignItems: "flex-start",
    paddingTop: 4
  },
  content: {
    gap: 12,
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 14
  },
  contentDesktop: {
    alignSelf: "center",
    maxWidth: 720,
    width: "100%"
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  hero: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    padding: 18
  },
  heroCopy: {
    flex: 1,
    gap: 5
  },
  heroName: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  heroRole: {
    fontSize: 14,
    fontWeight: "600"
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "700"
  },
  card: {
    gap: 10,
    padding: 18
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700"
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 40
  },
  detailIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  detailLabel: {
    fontSize: 12,
    width: 96
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right"
  },
  themeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  }
});
