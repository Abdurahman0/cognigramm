import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, Avatar, SectionHeader, ToggleItem } from "@/components/common";
import { WorkspacePane } from "@/components/layout";
import { AppText, Chip, GlassView, IconButton, ListRow, ListSection } from "@/components/ui";
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

  const accountRows: {
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    value: string;
    tint: string;
  }[] = [
    { icon: "mail", label: "Work email", value: user.email, tint: theme.colors.accent },
    { icon: "phone", label: "Phone", value: user.phone ?? "Not set", tint: theme.colors.success },
    { icon: "briefcase", label: "Department", value: user.department, tint: theme.colors.warning },
    { icon: "map-pin", label: "Location", value: user.officeLocation ?? "Not set", tint: theme.colors.danger },
    { icon: "clock", label: "Time zone", value: user.timezone, tint: theme.colors.textSecondary }
  ];

  const content = (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        isDesktop ? styles.contentDesktop : { paddingBottom: theme.layout.tabBarClearance }
      ]}
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

      <GlassView material="ultraThin" radius={theme.radius.panel} bordered={false} highlight style={styles.hero}>
        <Avatar
          uri={user.avatar}
          name={user.fullName}
          size={96}
          shape="squircle"
          showOnlineDot
          isOnline={user.isOnline}
        />
        <AppText variant="title1" style={styles.heroName}>
          {user.fullName}
        </AppText>
        <AppText variant="subhead" tone="secondary">
          {ROLE_LABELS[user.role]} · {user.title}
        </AppText>
        <View style={styles.heroBadges}>
          <View style={[styles.badge, { backgroundColor: theme.colors.fillTertiary }]}>
            <AppText variant="caption1" tone="secondary">
              {user.department}
            </AppText>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.colors.accentMuted }]}>
            <AppText variant="caption1" tone="accent">
              {PRESENCE_LABELS[user.presence]}
            </AppText>
          </View>
        </View>
      </GlassView>

      {user.about ? (
        <ListSection header="About">
          <View style={styles.aboutRow}>
            <AppText variant="body" tone="secondary">
              {user.about}
            </AppText>
          </View>
        </ListSection>
      ) : null}

      <ListSection header="Account">
        {accountRows.map((row) => (
          <ListRow
            key={row.label}
            icon={row.icon}
            iconColor={row.tint}
            title={row.label}
            value={row.value}
            showChevron={false}
          />
        ))}
      </ListSection>

      <ListSection header="Appearance" footer="Glass surfaces adapt to the selected appearance on mobile and web.">
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
          description="Tighter conversation rows for dense workflows."
          value={compactMode}
          onValueChange={setCompactMode}
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
    maxWidth: 760,
    width: "100%"
  },
  content: {
    gap: 18,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  contentDesktop: {
    alignSelf: "center",
    maxWidth: 680,
    width: "100%"
  },
  headerActions: {
    flexDirection: "row",
    gap: 8
  },
  hero: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 26
  },
  heroName: {
    marginTop: 12
  },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  aboutRow: {
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  themeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  signOutRow: {
    alignItems: "flex-start"
  }
});
