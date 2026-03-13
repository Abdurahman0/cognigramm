import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ScreenContainer, SectionHeader, ToggleItem } from "@/components/common";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSettingsStore } from "@/store/settingsStore";

export default function NotificationSettingsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const notifications = useSettingsStore((state) => state.notifications);
  const updateNotification = useSettingsStore((state) => state.updateNotification);

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <SectionHeader
          title="Notification Settings"
          subtitle="Control internal alerts and digest behavior"
          rightSlot={
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />

        <ToggleItem
          title="Push notifications"
          description="Receive real-time alerts on your devices."
          value={notifications.pushEnabled}
          onValueChange={(value) => updateNotification("pushEnabled", value)}
        />
        <ToggleItem
          title="Email digest"
          description="Daily summary of unread conversations."
          value={notifications.emailDigest}
          onValueChange={(value) => updateNotification("emailDigest", value)}
        />
        <ToggleItem
          title="Mentions only"
          description="Limit notifications to @mentions."
          value={notifications.mentionsOnly}
          onValueChange={(value) => updateNotification("mentionsOnly", value)}
        />
        <ToggleItem
          title="Urgent-only alerts"
          description="Get push alerts only for urgent priority messages."
          value={notifications.urgentOnly}
          onValueChange={(value) => updateNotification("urgentOnly", value)}
        />
        <ToggleItem
          title="Call alerts"
          description="Receive incoming call and meeting notifications."
          value={notifications.callAlerts}
          onValueChange={(value) => updateNotification("callAlerts", value)}
        />
        <ToggleItem
          title="Announcement alerts"
          description="Notify on leadership/HR announcement channels."
          value={notifications.announcementAlerts}
          onValueChange={(value) => updateNotification("announcementAlerts", value)}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12
  },
  closeBtn: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  }
});
