import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton, Avatar, ScreenContainer, SectionHeader, ToggleItem } from "@/components/common";
import { ROLE_LABELS } from "@/constants/roles";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";

export default function ProfileScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const user = useCurrentUser();
  const logout = useAuthStore((state) => state.logout);
  const compactMode = useSettingsStore((state) => state.compactMode);
  const setCompactMode = useSettingsStore((state) => state.setCompactMode);

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <SectionHeader
          title="Profile"
          subtitle="Your company account"
          rightSlot={
            <Pressable onPress={() => router.push("/(app)/profile/edit")} style={styles.iconBtn}>
              <Feather name="edit-2" size={18} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />

        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Avatar uri={user.avatar} name={user.fullName} size={68} showOnlineDot isOnline={user.isOnline} />
          <View style={styles.profileCopy}>
            <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{user.fullName}</Text>
            <Text style={[styles.role, { color: theme.colors.textSecondary }]}>
              {ROLE_LABELS[user.role]} • {user.title}
            </Text>
            <Text style={[styles.department, { color: theme.colors.textMuted }]}>{user.department} Department</Text>
          </View>
        </View>

        <View style={styles.quickLinks}>
          <Pressable
            onPress={() => router.push("/(app)/settings")}
            style={[styles.linkRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <Text style={[styles.linkLabel, { color: theme.colors.textPrimary }]}>General Settings</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/settings/notifications")}
            style={[styles.linkRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <Text style={[styles.linkLabel, { color: theme.colors.textPrimary }]}>Notification Settings</Text>
            <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <ToggleItem
          title="Compact chat density"
          description="Reduce spacing for dense desktop workflows."
          value={compactMode}
          onValueChange={setCompactMode}
        />

        <View style={{ marginTop: 12 }}>
          <AppButton
            variant="danger"
            label="Sign out"
            onPress={() => {
              logout();
              router.replace("/(auth)/login");
            }}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
    paddingBottom: 22
  },
  iconBtn: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14
  },
  profileCopy: {
    flex: 1,
    justifyContent: "center"
  },
  name: {
    fontSize: 20,
    fontWeight: "800"
  },
  role: {
    fontSize: 13,
    marginTop: 4
  },
  department: {
    fontSize: 12,
    marginTop: 3
  },
  quickLinks: {
    gap: 10
  },
  linkRow: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 14
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: "600"
  }
});
