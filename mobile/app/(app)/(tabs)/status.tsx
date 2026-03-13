import { Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, ScreenContainer, SectionHeader } from "@/components/common";
import { PRESENCE_LABELS } from "@/constants/chat";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import type { UserPresence } from "@/types";

const presenceOrder: UserPresence[] = ["available", "in_meeting", "busy", "on_break", "offline", "remote"];

export default function StatusScreen(): JSX.Element {
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const currentUser = useCurrentUser();
  const updateProfile = useChatStore((state) => state.updateCurrentUserProfile);

  return (
    <ScreenContainer scroll padded>
      <View style={styles.root}>
        <SectionHeader title="Work Status" subtitle="Set availability for your team" />

        <View style={styles.grid}>
          {presenceOrder.map((status) => {
            const active = currentUser.presence === status;
            return (
              <Pressable
                key={status}
                onPress={() => {
                  updateProfile({ presence: status, isOnline: status !== "offline" });
                  toast.success("Status updated", PRESENCE_LABELS[status]);
                }}
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface,
                    borderColor: active ? theme.colors.accent : theme.colors.border
                  }
                ]}
              >
                <Text style={[styles.statusLabel, { color: active ? theme.colors.accent : theme.colors.textPrimary }]}>
                  {PRESENCE_LABELS[status]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 18 }}>
          <EmptyState
            title="Company stories (internal)"
            description="Status updates, launch snapshots, and office moments can appear here in a future phase."
            icon="activity"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    minWidth: "48%",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "600"
  }
});
