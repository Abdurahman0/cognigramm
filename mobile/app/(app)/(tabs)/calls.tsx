import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, EmptyState, SectionHeader } from "@/components/common";
import { WorkspacePane } from "@/components/layout";
import { GlassView, IconButton } from "@/components/ui";
import { CALL_ROUTE_CONFIG } from "@/features/calls/config/callConfig";
import { formatCallDuration, getCallDurationMs } from "@/features/calls/utils/formatCallDuration";
import { CALL_STATUS_LABELS, CALL_TYPE_LABELS } from "@/constants/calls";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppToast } from "@/hooks/useAppToast";
import { useResponsive } from "@/hooks/useResponsive";
import { useCallsStore, useChatStore } from "@/store";
import type { CallSession } from "@/types";
import { formatMessageDate, formatRelative } from "@/utils/date";
import { useShallow } from "zustand/react/shallow";

const LIVE_STATUSES = new Set<CallSession["status"]>(["calling", "ringing", "connecting", "connected"]);

const getStateTone = (
  status: CallSession["status"],
  theme: ReturnType<typeof useAppTheme>["theme"]
): { backgroundColor: string; textColor: string } => {
  if (status === "connected") {
    return { backgroundColor: `${theme.colors.success}22`, textColor: theme.colors.success };
  }
  if (status === "missed" || status === "failed") {
    return { backgroundColor: theme.colors.dangerMuted, textColor: theme.colors.danger };
  }
  if (status === "ringing" || status === "calling" || status === "connecting") {
    return { backgroundColor: `${theme.colors.warning}22`, textColor: theme.colors.warning };
  }
  return { backgroundColor: theme.colors.glassSoft, textColor: theme.colors.textSecondary };
};

export default function CallsScreen(): JSX.Element {
  const router = useRouter();
  const toast = useAppToast();
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState("");

  const { history, loadingHistory, currentCall, refreshHistory, startCall } = useCallsStore(
    useShallow((state) => ({
      history: state.history,
      loadingHistory: state.loadingHistory,
      currentCall: state.currentCall,
      refreshHistory: state.refreshHistory,
      startCall: state.startCall
    }))
  );
  const chats = useChatStore((state) => state.chats);
  const setDesktopChat = useChatStore((state) => state.setActiveDesktopChatId);

  useFocusEffect(
    useCallback(() => {
      if (history.length > 0) {
        return () => undefined;
      }
      refreshHistory().catch(() => undefined);
      return () => undefined;
    }, [history.length, refreshHistory])
  );

  const calls = useMemo(
    () =>
      history.map((call) => ({
        ...call,
        title: chats.find((row) => row.id === call.conversationId)?.title ?? `Conversation #${call.conversationId}`
      })),
    [chats, history]
  );

  const selectedCall = useMemo(
    () => calls.find((call) => call.id === selectedCallId) ?? null,
    [calls, selectedCallId]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshHistory();
    } finally {
      setRefreshing(false);
    }
  };

  const openCallStage = (callId: string) => {
    router.push({
      pathname: CALL_ROUTE_CONFIG.detailsPathname as never,
      params: { callId } as never
    });
  };

  const redial = async (call: CallSession) => {
    try {
      const newCallId = await startCall({
        conversationId: call.conversationId,
        callType: call.callType
      });
      openCallStage(newCallId);
    } catch (error) {
      toast.error("Unable to start call", error instanceof Error ? error.message : "Unexpected error");
    }
  };

  const openConversation = (conversationId: string) => {
    if (isDesktop) {
      setDesktopChat(conversationId);
      router.replace("/(app)/(tabs)/chats");
      return;
    }
    router.push({ pathname: "/(app)/chat/[chatId]", params: { chatId: conversationId } });
  };

  const listPane = (
    <View style={styles.pane}>
      <View style={styles.header}>
        <SectionHeader
          title="Calls"
          subtitle={`${calls.length} sessions in history`}
          rightSlot={
            currentCall && LIVE_STATUSES.has(currentCall.status) ? (
              <IconButton
                icon="phone-call"
                accessibilityLabel="Open the active call"
                tone="success"
                onPress={() => openCallStage(currentCall.id)}
              />
            ) : (
              <IconButton
                icon="refresh-cw"
                accessibilityLabel="Refresh call history"
                disabled={loadingHistory}
                onPress={() => {
                  handleRefresh().catch(() => undefined);
                }}
              />
            )
          }
        />
      </View>

      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loadingHistory}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="No call history yet"
            description="Start a call from any conversation and it will appear here."
            icon="phone-call"
          />
        }
        renderItem={({ item }) => {
          const tone = getStateTone(item.status, theme);
          const live = currentCall?.id === item.id && LIVE_STATUSES.has(item.status);
          const active = selectedCallId === item.id;
          const durationMs = getCallDurationMs(item);
          const durationLabel = durationMs > 0 ? formatCallDuration(durationMs) : "";

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (isDesktop && !live) {
                  setSelectedCallId(item.id);
                  return;
                }
                openCallStage(item.id);
              }}
              style={({ pressed, hovered }) => [
                styles.row,
                {
                  borderRadius: theme.radius.lg,
                  backgroundColor: active || live
                    ? theme.colors.accentMuted
                    : hovered
                    ? theme.colors.glassHover
                    : theme.colors.glassSoft,
                  opacity: pressed ? 0.9 : 1
                }
              ]}
            >
              <View
                style={[
                  styles.rowIcon,
                  {
                    backgroundColor: item.callType === "video" ? theme.colors.accentMuted : theme.colors.glassHover
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
                <Text numberOfLines={1} style={[styles.rowMeta, { color: theme.colors.textMuted }]}>
                  {CALL_TYPE_LABELS[item.callType]} · {formatRelative(item.updatedAt)}
                  {durationLabel ? ` · ${durationLabel}` : ""}
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
  );

  if (!isDesktop) {
    return (
      <SafeAreaView edges={["top"]} style={styles.mobileRoot}>
        {listPane}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.desktopRoot}>
      <WorkspacePane width={theme.layout.listPaneWidth}>{listPane}</WorkspacePane>
      <WorkspacePane>
        {selectedCall ? (
          <View style={styles.detail}>
            <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.detailHero}>
              <View style={[styles.detailIcon, { backgroundColor: theme.colors.accentMuted }]}>
                <Feather
                  name={selectedCall.callType === "video" ? "video" : "phone"}
                  size={24}
                  color={theme.colors.accent}
                />
              </View>
              <Text style={[styles.detailTitle, { color: theme.colors.textPrimary }]}>{selectedCall.title}</Text>
              <Text style={[styles.detailMeta, { color: theme.colors.textMuted }]}>
                {CALL_TYPE_LABELS[selectedCall.callType]} call · {CALL_STATUS_LABELS[selectedCall.status]}
              </Text>
            </GlassView>

            <GlassView tone="soft" radius={theme.radius.xxl} bordered={false} style={styles.detailCard}>
              {[
                {
                  label: "Duration",
                  value: getCallDurationMs(selectedCall) > 0 ? formatCallDuration(getCallDurationMs(selectedCall)) : "—"
                },
                { label: "Direction", value: selectedCall.direction === "incoming" ? "Incoming" : "Outgoing" },
                { label: "Participants", value: `${selectedCall.participants.length}` },
                { label: "Started", value: selectedCall.startedAt ? formatMessageDate(selectedCall.startedAt) : "—" },
                { label: "Last update", value: formatMessageDate(selectedCall.updatedAt) }
              ].map((row) => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={[styles.detailRowLabel, { color: theme.colors.textMuted }]}>{row.label}</Text>
                  <Text style={[styles.detailRowValue, { color: theme.colors.textPrimary }]}>{row.value}</Text>
                </View>
              ))}
            </GlassView>

            <View style={styles.detailActions}>
              <AppButton
                label={`Call again`}
                fullWidth={false}
                icon={<Feather name="phone-call" size={15} color={theme.colors.onAccent} />}
                onPress={() => {
                  redial(selectedCall).catch(() => undefined);
                }}
              />
              <AppButton
                label="Open conversation"
                variant="secondary"
                fullWidth={false}
                onPress={() => openConversation(selectedCall.conversationId)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.emptyPane}>
            <EmptyState
              title="Select a call"
              description="Pick a session to review its details, redial, or jump into the conversation."
              icon="phone"
            />
          </View>
        )}
      </WorkspacePane>
    </View>
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
    gap: 10,
    minWidth: 0
  },
  pane: {
    flex: 1,
    minWidth: 0
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 12
  },
  list: {
    flex: 1,
    marginTop: 12
  },
  listContent: {
    paddingBottom: 12,
    paddingHorizontal: 8
  },
  separator: {
    height: 8
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 12
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  rowCopy: {
    flex: 1,
    gap: 3
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
  },
  detail: {
    flex: 1,
    gap: 12,
    padding: 16
  },
  detailHero: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 26
  },
  detailIcon: {
    alignItems: "center",
    borderRadius: 20,
    height: 60,
    justifyContent: "center",
    width: 60
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 6
  },
  detailMeta: {
    fontSize: 13
  },
  detailCard: {
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 38
  },
  detailRowLabel: {
    fontSize: 12
  },
  detailRowValue: {
    fontSize: 13,
    fontWeight: "600"
  },
  detailActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  emptyPane: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28
  }
});
