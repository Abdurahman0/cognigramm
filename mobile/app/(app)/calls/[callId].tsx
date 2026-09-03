import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/common";
import { AppShell, WorkspacePane } from "@/components/layout";
import { GlassView, IconButton } from "@/components/ui";
import {
  CallControls,
  CallMediaViewport,
  formatCallDuration,
  getCallDurationMs,
  useCallController
} from "@/features/calls";
import { ChatListPane } from "@/features/chat/ChatListPane";
import { CALL_STATUS_LABELS, CALL_TYPE_LABELS } from "@/constants/calls";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAppToast } from "@/hooks/useAppToast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useResponsive } from "@/hooks/useResponsive";
import { useChatStore } from "@/store/chatStore";

const isTerminalStatus = new Set(["ended", "failed", "declined", "missed"]);

export default function CallDetailsScreen(): JSX.Element {
  const router = useRouter();
  const toast = useAppToast();
  const { theme } = useAppTheme();
  const { isDesktop } = useResponsive();
  const currentUser = useCurrentUser();
  const { callId, autoAccept } = useLocalSearchParams<{
    callId: string;
    autoAccept?: string;
  }>();
  const autoAcceptHandledRef = useRef("");
  const endedRedirectedRef = useRef("");
  const chats = useChatStore((state) => state.chats);
  const users = useChatStore((state) => state.users);
  const setDesktopChat = useChatStore((state) => state.setActiveDesktopChatId);
  const [durationTickMs, setDurationTickMs] = useState(() => Date.now());

  const {
    session,
    runtime,
    incomingFromUserId,
    loading,
    joinCallById,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleSpeaker,
    clearError
  } = useCallController({ callId });

  useEffect(() => {
    if (!callId) {
      return;
    }
    if (session?.id === callId) {
      return;
    }
    joinCallById(callId).catch((error) => {
      toast.error("Unable to load call", error instanceof Error ? error.message : "Unexpected error");
    });
  }, [callId, joinCallById, session?.id, toast]);

  useEffect(() => {
    if (!callId || autoAccept !== "1") {
      return;
    }
    if (autoAcceptHandledRef.current === callId) {
      return;
    }
    if (!session || session.id !== callId) {
      return;
    }
    if (session.direction !== "incoming" || session.status !== "ringing") {
      return;
    }

    autoAcceptHandledRef.current = callId;
    acceptIncomingCall(callId).catch((error) => {
      toast.error("Unable to accept call", error instanceof Error ? error.message : "Unexpected error");
      autoAcceptHandledRef.current = "";
    });
  }, [acceptIncomingCall, autoAccept, callId, session, toast]);

  const conversationTitle = useMemo(() => {
    if (!session) {
      return "";
    }
    return chats.find((chat) => chat.id === session.conversationId)?.title ?? `Conversation #${session.conversationId}`;
  }, [chats, session]);

  const peer = useMemo(() => {
    if (!session) {
      return null;
    }
    const peerUserId = session.participants.find((row) => row.userId !== currentUser.id)?.userId;
    if (!peerUserId) {
      return null;
    }
    return users.find((user) => user.id === peerUserId) ?? null;
  }, [currentUser.id, session, users]);

  useEffect(() => {
    if (!session) {
      return;
    }
    if (!isTerminalStatus.has(session.status)) {
      if (endedRedirectedRef.current === session.id) {
        endedRedirectedRef.current = "";
      }
      return;
    }
    if (endedRedirectedRef.current === session.id) {
      return;
    }

    endedRedirectedRef.current = session.id;
    if (isDesktop) {
      setDesktopChat(session.conversationId);
      router.replace("/(app)/(tabs)/chats");
      return;
    }
    router.replace({
      pathname: "/(app)/chat/[chatId]" as never,
      params: { chatId: session.conversationId } as never
    });
  }, [isDesktop, router, session, setDesktopChat]);

  useEffect(() => {
    if (!session || session.status !== "connected" || session.endedAt) {
      return;
    }
    const timer = setInterval(() => {
      setDurationTickMs(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [session, session?.endedAt, session?.id, session?.status]);

  const closeStage = () => {
    if (isDesktop) {
      router.replace("/(app)/(tabs)/chats");
      return;
    }
    router.back();
  };

  const openChatFromList = (chatId: string) => {
    setDesktopChat(chatId);
    router.replace("/(app)/(tabs)/chats");
  };

  const withShell = (content: JSX.Element): JSX.Element => {
    if (!isDesktop) {
      return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.mobileRoot}>
          {content}
        </SafeAreaView>
      );
    }

    return (
      <AppShell>
        <View style={styles.desktopRoot}>
          <WorkspacePane width={theme.layout.listPaneWidth}>
            <ChatListPane onSelectChat={openChatFromList} />
          </WorkspacePane>
          <WorkspacePane>{content}</WorkspacePane>
        </View>
      </AppShell>
    );
  };

  if (!callId) {
    return withShell(
      <View style={styles.centered}>
        <EmptyState title="Call not found" description="Select a valid call session." icon="phone-missed" />
      </View>
    );
  }

  if (!session) {
    return withShell(
      <View style={styles.centered}>
        <EmptyState title="Loading call" description="Fetching the latest call session…" icon="loader" />
      </View>
    );
  }

  const title = peer?.fullName || conversationTitle || "Call session";
  const statusLabel = CALL_STATUS_LABELS[runtime.status];
  const isIncoming = session.direction === "incoming" || incomingFromUserId.length > 0;
  const durationMs = getCallDurationMs(session, durationTickMs);
  const durationLabel = durationMs > 0 ? formatCallDuration(durationMs) : "";
  const caption = durationLabel || statusLabel;

  return withShell(
    <View style={styles.stage}>
      <View style={styles.stageHeader}>
        <IconButton
          icon="chevron-left"
          accessibilityLabel="Leave call view"
          tone="plain"
          onPress={closeStage}
        />
        <View style={styles.stageHeaderCopy}>
          <Text numberOfLines={1} style={[styles.stageTitle, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.stageMeta, { color: theme.colors.textMuted }]}>
            {CALL_TYPE_LABELS[session.callType]} call · {statusLabel}
            {durationLabel ? ` · ${durationLabel}` : ""}
          </Text>
        </View>
        <IconButton
          icon="user-plus"
          accessibilityLabel="Open conversation details"
          onPress={() =>
            router.push({
              pathname: "/(app)/chat-info/[chatId]" as never,
              params: { chatId: session.conversationId } as never
            })
          }
        />
      </View>

      {runtime.status === "connecting" ? (
        <GlassView tone="soft" radius={theme.radius.lg} bordered={false} style={styles.notice}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={[styles.noticeText, { color: theme.colors.textSecondary }]}>
            Establishing a secure connection…
          </Text>
        </GlassView>
      ) : null}

      {runtime.errorMessage ? (
        <Pressable
          onPress={clearError}
          accessibilityRole="button"
          accessibilityLabel="Dismiss call error"
          style={[
            styles.notice,
            {
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.dangerMuted
            }
          ]}
        >
          <Text style={[styles.noticeText, { color: theme.colors.danger }]}>{runtime.errorMessage}</Text>
        </Pressable>
      ) : null}

      <CallMediaViewport
        callType={session.callType}
        peerName={peer?.fullName ?? title}
        peerAvatar={peer?.avatar}
        runtime={runtime}
        caption={caption}
      />

      <GlassView tone="strong" radius={theme.radius.panel} highlight style={styles.controlDock}>
        <CallControls
          callId={session.id}
          status={runtime.status}
          callType={session.callType}
          isIncoming={isIncoming}
          isMuted={runtime.isMuted}
          isCameraEnabled={runtime.isCameraEnabled}
          speakerEnabled={runtime.speakerEnabled}
          canSwitchCamera={runtime.canSwitchCamera}
          controlsDisabled={loading}
          onAccept={(targetCallId) => {
            acceptIncomingCall(targetCallId).catch((error) => {
              toast.error("Unable to accept call", error instanceof Error ? error.message : "Unexpected error");
            });
          }}
          onDecline={(targetCallId) => {
            declineIncomingCall(targetCallId).catch((error) => {
              toast.error("Unable to decline call", error instanceof Error ? error.message : "Unexpected error");
            });
          }}
          onEnd={(targetCallId) => {
            endCall(targetCallId).catch((error) => {
              toast.error("Unable to end call", error instanceof Error ? error.message : "Unexpected error");
            });
          }}
          onToggleMute={() => {
            toggleMute().catch((error) => {
              toast.error("Unable to update microphone", error instanceof Error ? error.message : "Unexpected error");
            });
          }}
          onToggleCamera={() => {
            toggleCamera().catch((error) => {
              toast.error("Unable to update camera", error instanceof Error ? error.message : "Unexpected error");
            });
          }}
          onSwitchCamera={() => {
            switchCamera().catch((error) => {
              toast.error("Unable to switch camera", error instanceof Error ? error.message : "Unexpected error");
            });
          }}
          onToggleSpeaker={() => {
            toggleSpeaker().catch((error) => {
              toast.error("Unable to update speaker", error instanceof Error ? error.message : "Unexpected error");
            });
          }}
        />
      </GlassView>
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
  centered: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  stage: {
    flex: 1,
    gap: 12,
    padding: 14
  },
  stageHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  stageHeaderCopy: {
    flex: 1,
    gap: 2
  },
  stageTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  stageMeta: {
    fontSize: 12
  },
  notice: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600"
  },
  controlDock: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16
  }
});
