import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Platform, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton, EmptyState } from "@/components/common";
import { FloatingTitleBar, WorkspacePane } from "@/components/layout";
import { AppText, GlassView, IconButton, ListRow, ListSection, RaisedCard } from "@/components/ui";
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

export default function CallsScreen(): JSX.Element {
  const router = useRouter();
  const toast = useAppToast();
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState("");
  const [barHeight, setBarHeight] = useState(52);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  const bottomClearance = isDesktop ? 16 : theme.layout.tabBarClearance;

  const listHeader = (
    <View style={styles.listHeader}>
      <AppText variant="largeTitle">Calls</AppText>
      <AppText variant="subhead" tone="secondary" style={styles.subtitle}>
        {calls.length} in history
      </AppText>
    </View>
  );

  const listPane = (
    <View style={styles.pane}>
      <Animated.FlatList
        data={calls}
        keyExtractor={(item: (typeof calls)[number]) => item.id}
        style={styles.list}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: Platform.OS !== "web"
        })}
        scrollEventThrottle={16}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: barHeight + 18, paddingBottom: bottomClearance }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loadingHistory}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="No call history"
            description="Start a call from any conversation and it will appear here."
            icon="phone-call"
          />
        }
        renderItem={({ item }: { item: (typeof calls)[number] }) => {
          const live = currentCall?.id === item.id && LIVE_STATUSES.has(item.status);
          const active = selectedCallId === item.id;
          const missed = item.status === "missed" || item.status === "failed";
          const durationMs = getCallDurationMs(item);
          const durationLabel = durationMs > 0 ? formatCallDuration(durationMs) : "";

          return (
            <RaisedCard
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (isDesktop && !live) {
                  setSelectedCallId(item.id);
                  return;
                }
                openCallStage(item.id);
              }}
              active={active || live}
              radius={theme.radius.lg}
              style={styles.rowOuter}
              contentStyle={styles.row}
            >
              <Feather
                name={item.callType === "video" ? "video" : "phone"}
                size={18}
                color={missed ? theme.colors.danger : theme.colors.accent}
              />
              <View style={styles.rowCopy}>
                <AppText variant="body" tone={missed ? "danger" : "primary"} numberOfLines={1}>
                  {item.title}
                </AppText>
                <AppText variant="footnote" tone="secondary" numberOfLines={1}>
                  {CALL_TYPE_LABELS[item.callType]} · {CALL_STATUS_LABELS[item.status]}
                  {durationLabel ? ` · ${durationLabel}` : ""}
                </AppText>
              </View>
              <AppText variant="footnote" tone="tertiary">
                {formatRelative(item.updatedAt)}
              </AppText>
              <Feather name="info" size={17} color={theme.colors.accent} />
            </RaisedCard>
          );
        }}
      />

      <FloatingTitleBar
        title="Calls"
        scrollY={scrollY}
        onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
        actions={
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
            <GlassView
              material="ultraThin"
              radius={theme.radius.panel}
              bordered={false}
              highlight
              style={styles.detailHero}
            >
              <View style={[styles.detailIcon, { backgroundColor: theme.colors.accentMuted }]}>
                <Feather
                  name={selectedCall.callType === "video" ? "video" : "phone"}
                  size={26}
                  color={theme.colors.accent}
                />
              </View>
              <AppText variant="title2" style={styles.detailTitle}>
                {selectedCall.title}
              </AppText>
              <AppText variant="subhead" tone="secondary">
                {CALL_TYPE_LABELS[selectedCall.callType]} call · {CALL_STATUS_LABELS[selectedCall.status]}
              </AppText>
            </GlassView>

            <ListSection header="Details">
              <ListRow
                title="Duration"
                value={
                  getCallDurationMs(selectedCall) > 0
                    ? formatCallDuration(getCallDurationMs(selectedCall))
                    : "—"
                }
                showChevron={false}
              />
              <ListRow
                title="Direction"
                value={selectedCall.direction === "incoming" ? "Incoming" : "Outgoing"}
                showChevron={false}
              />
              <ListRow title="Participants" value={`${selectedCall.participants.length}`} showChevron={false} />
              <ListRow
                title="Started"
                value={selectedCall.startedAt ? formatMessageDate(selectedCall.startedAt) : "—"}
                showChevron={false}
              />
              <ListRow title="Last update" value={formatMessageDate(selectedCall.updatedAt)} showChevron={false} />
            </ListSection>

            <View style={styles.detailActions}>
              <AppButton
                label="Call again"
                fullWidth={false}
                icon={<Feather name="phone-call" size={16} color={theme.colors.onAccent} />}
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
  listHeader: {
    gap: 4,
    paddingBottom: 10,
    paddingHorizontal: 8,
    paddingTop: 6
  },
  subtitle: {
    marginTop: -2
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 8
  },
  rowOuter: {
    paddingVertical: 4
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  rowCopy: {
    flex: 1,
    gap: 1
  },
  detail: {
    flex: 1,
    gap: 18,
    padding: 18
  },
  detailHero: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 28
  },
  detailIcon: {
    alignItems: "center",
    borderRadius: 22,
    height: 64,
    justifyContent: "center",
    width: 64
  },
  detailTitle: {
    marginTop: 12
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
