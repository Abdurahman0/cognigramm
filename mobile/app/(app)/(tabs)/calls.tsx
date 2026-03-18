import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";

import { CALL_STATUS_LABELS, CALL_TYPE_LABELS } from "@/constants/calls";
import { EmptyState, ScreenContainer, SectionHeader } from "@/components/common";
import { CALL_ROUTE_CONFIG } from "@/features/calls/config/callConfig";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCallsStore, useChatStore } from "@/store";
import type { CallSession } from "@/types";
import { formatRelative } from "@/utils/date";
import { useShallow } from "zustand/react/shallow";

const getStateTone = (
  status: CallSession["status"],
  theme: ReturnType<typeof useAppTheme>["theme"]
): { backgroundColor: string; textColor: string } => {
  if (status === "connected") {
    return { backgroundColor: theme.colors.success + "22", textColor: theme.colors.success };
  }
  if (status === "missed" || status === "failed") {
    return { backgroundColor: theme.colors.danger + "1F", textColor: theme.colors.danger };
  }
  if (status === "ringing" || status === "calling" || status === "connecting") {
    return { backgroundColor: theme.colors.warning + "22", textColor: theme.colors.warning };
  }
  return { backgroundColor: theme.colors.surfaceMuted, textColor: theme.colors.textSecondary };
};

export default function CallsScreen(): JSX.Element {
  const router = useRouter();
  const { theme } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const { history, loadingHistory, currentCall, refreshHistory } = useCallsStore(
    useShallow((state) => ({
      history: state.history,
      loadingHistory: state.loadingHistory,
      currentCall: state.currentCall,
      refreshHistory: state.refreshHistory
    }))
  );
  const chats = useChatStore((state) => state.chats);

  useFocusEffect(
    useCallback(() => {
      if (history.length > 0) {
        return () => undefined;
      }
      refreshHistory().catch(() => undefined);
      return () => undefined;
    }, [history.length, refreshHistory])
  );

  const calls = useMemo(() => {
    return history.map((call) => {
      const chat = chats.find((row) => row.id === call.conversationId);
      return {
        ...call,
        title: chat?.title ?? `Conversation #${call.conversationId}`
      };
    });
  }, [history, chats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshHistory();
    } finally {
      setRefreshing(false);
    }
  };
  const openCallDetails = (callId: string) => {
    router.push({
      pathname: CALL_ROUTE_CONFIG.detailsPathname as never,
      params: { callId } as never
    });
  };

  return (
    <ScreenContainer padded={false}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <SectionHeader
          title="Calls"
          subtitle="History and active sessions"
          rightSlot={
            currentCall ? (
              <Pressable
                onPress={() => openCallDetails(currentCall.id)}
                style={[styles.currentCallBtn, { borderColor: theme.colors.accent }]}
              >
                <Feather name="phone-call" size={14} color={theme.colors.accent} />
                <Text style={[styles.currentCallText, { color: theme.colors.accent }]}>Open</Text>
              </Pressable>
            ) : null
          }
        />
      </View>

      <View style={styles.content}>
        <FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || loadingHistory}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No call history yet"
              description="Start a call from a conversation to see records here."
              icon="phone-call"
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const tone = getStateTone(item.status, theme);
            const active = currentCall?.id === item.id && item.status === "connected";
            return (
              <Pressable
                onPress={() => openCallDetails(item.id)}
                style={[
                  styles.row,
                  {
                    borderColor: active ? theme.colors.accent : theme.colors.border,
                    backgroundColor: active ? theme.colors.accentMuted : theme.colors.surface
                  }
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    {
                      backgroundColor: item.callType === "video" ? theme.colors.accentMuted : theme.colors.surfaceMuted
                    }
                  ]}
                >
                  <Feather
                    name={item.callType === "video" ? "video" : "phone"}
                    size={16}
                    color={item.callType === "video" ? theme.colors.accent : theme.colors.textSecondary}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.colors.textMuted }]}>
                    {CALL_TYPE_LABELS[item.callType]} call - {formatRelative(item.updatedAt)}
                  </Text>
                </View>
                <View style={[styles.stateChip, { backgroundColor: tone.backgroundColor }]}>
                  <Text style={[styles.stateLabel, { color: tone.textColor }]}>
                    {CALL_STATUS_LABELS[item.status]}
                  </Text>
                </View>
              </Pressable>
            );
          }}
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
  currentCallBtn: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  currentCallText: {
    fontSize: 12,
    fontWeight: "700"
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  listContent: {
    paddingBottom: 20,
    flexGrow: 1
  },
  row: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 72,
    paddingHorizontal: 12
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  rowCopy: {
    flex: 1,
    gap: 3,
    marginLeft: 10
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700"
  },
  rowMeta: {
    fontSize: 12
  },
  stateChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  stateLabel: {
    fontSize: 11,
    fontWeight: "700"
  }
});
