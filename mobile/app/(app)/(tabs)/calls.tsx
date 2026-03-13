import { Feather } from "@expo/vector-icons";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, EmptyState, ScreenContainer, SectionHeader } from "@/components/common";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import { formatRelative } from "@/utils/date";
import { useShallow } from "zustand/react/shallow";

export default function CallsScreen(): JSX.Element {
  const { theme } = useAppTheme();
  const toast = useAppToast();
  const { calls, users } = useChatStore(useShallow((state) => ({
    calls: state.calls,
    users: state.users
  })));

  const rows = useMemo(
    () =>
      calls.map((call) => ({
        call,
        user: users.find((candidate) => candidate.id === call.participantId)
      })),
    [calls, users]
  );

  return (
    <ScreenContainer padded={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader
          title="Calls"
          subtitle="Voice and video activity"
          rightSlot={
            <Pressable
              onPress={() => toast.info("Schedule meeting", "Calendar integration ready for backend phase.")}
              style={styles.actionButton}
            >
              <Feather name="calendar" size={18} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />
      </View>
      <View style={styles.listWrap}>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.call.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<EmptyState title="No calls yet" description="Your call activity appears here." icon="phone" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                toast.success(
                  item.call.mode === "video" ? "Video call started (demo)" : "Voice call started (demo)",
                  item.user?.fullName ?? "Unknown participant"
                )
              }
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border
                }
              ]}
            >
              <Avatar uri={item.user?.avatar} name={item.user?.fullName ?? "Unknown"} size={42} />
              <View style={styles.main}>
                <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{item.user?.fullName ?? "Unknown"}</Text>
                <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
                  {item.call.mode === "video" ? "Video" : "Voice"} • {item.call.result} • {formatRelative(item.call.createdAt)}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={[styles.duration, { color: theme.colors.textSecondary }]}>{item.call.durationLabel}</Text>
                <Feather
                  name={item.call.result === "missed" ? "phone-missed" : "phone-call"}
                  size={17}
                  color={item.call.result === "missed" ? theme.colors.danger : theme.colors.success}
                />
              </View>
            </Pressable>
          )}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  actionButton: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  },
  listWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  row: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 74,
    paddingHorizontal: 12
  },
  main: {
    flex: 1,
    marginHorizontal: 10,
    gap: 4
  },
  name: {
    fontSize: 15,
    fontWeight: "700"
  },
  meta: {
    fontSize: 12
  },
  right: {
    alignItems: "flex-end",
    gap: 4
  },
  duration: {
    fontSize: 12,
    fontWeight: "600"
  }
});
