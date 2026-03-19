import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";

import { EmptyState, ScreenContainer, SectionHeader } from "@/components/common";
import {
  CallControls,
  CallMediaViewport,
  formatCallDuration,
  getCallDurationMs,
  useCallController
} from "@/features/calls";
import { CALL_STATUS_LABELS, CALL_TYPE_LABELS } from "@/constants/calls";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppToast } from "@/hooks/useAppToast";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useChatStore } from "@/store/chatStore";
import { formatMessageDate } from "@/utils/date";

const isTerminalStatus = new Set(["ended", "failed", "declined", "missed"]);

export default function CallDetailsScreen(): JSX.Element {
  const router = useRouter();
  const toast = useAppToast();
  const { theme } = useAppTheme();
  const currentUser = useCurrentUser();
  const { callId, autoAccept } = useLocalSearchParams<{
    callId: string;
    autoAccept?: string;
  }>();
  const autoAcceptHandledRef = useRef("");
  const endedRedirectedRef = useRef("");
  const chats = useChatStore((state) => state.chats);
  const users = useChatStore((state) => state.users);
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
    router.replace({
      pathname: "/(app)/chat/[chatId]" as never,
      params: { chatId: session.conversationId } as never
    });
  }, [router, session]);

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

  if (!callId) {
    return (
      <ScreenContainer scroll padded={false}>
        <View style={styles.page}>
          <EmptyState title="Call not found" description="Select a valid call session." icon="phone-missed" />
        </View>
      </ScreenContainer>
    );
  }

  if (!session) {
    return (
      <ScreenContainer scroll padded={false}>
        <View style={styles.page}>
          <SectionHeader
            title="Call"
            subtitle={callId}
            rightSlot={
              <Pressable onPress={() => router.back()} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.colors.textPrimary} />
              </Pressable>
            }
          />
          <EmptyState title="Loading call" description="Fetching the latest call session..." icon="loader" />
        </View>
      </ScreenContainer>
    );
  }

  const title = conversationTitle || peer?.fullName || "Call Session";
  const statusLabel = CALL_STATUS_LABELS[runtime.status];
  const isIncoming = session.direction === "incoming" || incomingFromUserId.length > 0;
  const showConnecting = runtime.status === "connecting";
  const terminal = isTerminalStatus.has(runtime.status);
  const callUpdatedAt = formatMessageDate(session.updatedAt);
  const durationMs = getCallDurationMs(session, durationTickMs);
  const durationLabel = durationMs > 0 ? formatCallDuration(durationMs) : "";

  return (
    <ScreenContainer scroll padded={false}>
      <View style={styles.page}>
        <SectionHeader
          title="Call Session"
          subtitle={title}
          rightSlot={
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          }
        />

        <View style={[styles.summaryCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={[styles.summaryIcon, { backgroundColor: theme.colors.accentMuted }]}>
            <Feather name={session.callType === "video" ? "video" : "phone"} size={20} color={theme.colors.accent} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryTitle, { color: theme.colors.textPrimary }]}>
              {CALL_TYPE_LABELS[session.callType]} call
            </Text>
            <Text style={[styles.summaryMeta, { color: theme.colors.textSecondary }]}>
              {statusLabel} - updated {callUpdatedAt}
            </Text>
            {durationLabel ? (
              <Text style={[styles.summaryMeta, { color: theme.colors.textSecondary }]}>
                Duration: {durationLabel}
              </Text>
            ) : null}
            <Text style={[styles.summaryMeta, { color: theme.colors.textMuted }]}>Call ID: {session.id}</Text>
          </View>
        </View>

        {showConnecting ? (
          <View style={[styles.connectingCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={[styles.connectingText, { color: theme.colors.textSecondary }]}>Establishing connection...</Text>
          </View>
        ) : null}

        {runtime.errorMessage ? (
          <Pressable
            onPress={clearError}
            style={[styles.errorCard, { borderColor: theme.colors.danger, backgroundColor: theme.colors.danger + "14" }]}
          >
            <Feather name="alert-triangle" size={14} color={theme.colors.danger} />
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>{runtime.errorMessage}</Text>
          </Pressable>
        ) : null}

        <CallMediaViewport
          callType={session.callType}
          peerName={peer?.fullName ?? "Participant"}
          peerAvatar={peer?.avatar}
          runtime={runtime}
        />

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

        {terminal ? (
          <Pressable
            onPress={() => router.back()}
            style={[styles.closeSessionButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.closeSessionText, { color: theme.colors.textSecondary }]}>Close</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22
  },
  closeBtn: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 34
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  summaryIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  summaryCopy: {
    flex: 1,
    gap: 2
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800"
  },
  summaryMeta: {
    fontSize: 12
  },
  connectingCard: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12
  },
  connectingText: {
    fontSize: 12,
    fontWeight: "600"
  },
  errorCard: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  errorText: {
    flex: 1,
    fontSize: 12
  },
  closeSessionButton: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center"
  },
  closeSessionText: {
    fontSize: 13,
    fontWeight: "700"
  }
});
