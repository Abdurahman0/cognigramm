import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CALL_TIMEOUTS_MS } from "@/features/calls/config/callConfig";
import { useCallPermissions } from "@/features/calls/hooks/useCallPermissions";
import { signalingAdapter } from "@/features/calls/services/signalingAdapter";
import { createWebRtcAdapter } from "@/features/calls/services/webrtcAdapter";
import type {
  CallRuntimeState,
  CallSession,
  CallStatus,
  OutgoingCallRequest,
  UseCallControllerResult
} from "@/features/calls/types";
import { callLogger } from "@/features/calls/utils/callLogger";
import { useAuthStore } from "@/store/authStore";
import { useCallsStore } from "@/store/callsStore";

interface UseCallControllerOptions {
  callId?: string;
  conversationId?: string;
}

const initialRuntimeState: CallRuntimeState = {
  status: "idle",
  direction: null,
  transportState: "idle",
  localMedia: {
    hasStream: false,
    audioEnabled: false,
    videoEnabled: false,
    stream: null,
    errorMessage: ""
  },
  remoteMedia: {
    hasStream: false,
    hasVideo: false,
    stream: null
  },
  isMuted: false,
  isCameraEnabled: false,
  speakerEnabled: true,
  canSwitchCamera: false,
  errorMessage: ""
};

const resolveRuntimeStatus = (
  session: CallSession | null,
  currentStatus: CallStatus
): CallStatus => {
  if (!session) {
    return "idle";
  }
  if (currentStatus === "connecting" && session.status === "calling") {
    return "connecting";
  }
  return session.status;
};

const resolveDirection = (
  session: CallSession,
  sessionUserId: string
): "incoming" | "outgoing" => {
  return session.direction ||
    (session.initiatorId === sessionUserId ? "outgoing" : "incoming");
};

const resolveTargetUserId = (
  session: CallSession,
  sessionUserId: string
): string => {
  const peer = session.participants.find((row) => row.userId !== sessionUserId);
  if (peer?.userId) {
    return peer.userId;
  }
  if (session.initiatorId !== sessionUserId) {
    return session.initiatorId;
  }
  return "";
};

const liveStatuses = new Set<CallStatus>([
  "calling",
  "ringing",
  "connecting",
  "connected"
]);

const terminalStatuses = new Set<CallStatus>([
  "ended",
  "failed",
  "declined",
  "missed"
]);

export const useCallController = (
  options: UseCallControllerOptions = {}
): UseCallControllerResult => {
  const { callId, conversationId } = options;
  const { requestForCallType } = useCallPermissions();
  const sessionUserId = useAuthStore((state) => state.session?.userId ?? "");
  const adapterRef = useRef(
    createWebRtcAdapter({
      onSignal: (signal) => {
        signalingAdapter.sendWebRtcSignal(signal);
      }
    })
  );
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preparingCallIdRef = useRef("");

  const history = useCallsStore((state) => state.history);
  const currentCall = useCallsStore((state) => state.currentCall);
  const incomingFromUserId = useCallsStore((state) => state.incomingFromUserId);
  const loadingHistory = useCallsStore((state) => state.loadingHistory);
  const latestSignal = useCallsStore((state) => state.latestSignal);
  const clearLatestSignal = useCallsStore((state) => state.clearLatestSignal);
  const startCall = useCallsStore((state) => state.startCall);
  const loadCallById = useCallsStore((state) => state.loadCallById);
  const acceptCall = useCallsStore((state) => state.acceptCall);
  const rejectCall = useCallsStore((state) => state.rejectCall);
  const endCallFromStore = useCallsStore((state) => state.endCall);

  const [runtime, setRuntime] = useState<CallRuntimeState>(initialRuntimeState);
  const [loading, setLoading] = useState(false);

  const session = useMemo(() => {
    if (!callId) {
      if (!currentCall) {
        return null;
      }
      if (conversationId && currentCall.conversationId !== conversationId) {
        return null;
      }
      return currentCall;
    }
    if (currentCall?.id === callId) {
      return currentCall;
    }
    return history.find((row) => row.id === callId) ?? null;
  }, [callId, conversationId, currentCall, history]);

  const applyRuntimeError = useCallback((message: string) => {
    setRuntime((state) => ({
      ...state,
      errorMessage: message,
      localMedia: {
        ...state.localMedia,
        errorMessage: message
      },
      status: state.status === "idle" ? "failed" : state.status
    }));
  }, []);

  useEffect(() => {
    const unsubscribe = adapterRef.current.subscribe((snapshot) => {
      setRuntime((state) => ({
        ...state,
        transportState: snapshot.transportState,
        localMedia: snapshot.localMedia,
        remoteMedia: snapshot.remoteMedia,
        isMuted: snapshot.isMuted,
        isCameraEnabled: snapshot.isCameraEnabled,
        speakerEnabled: snapshot.speakerEnabled,
        canSwitchCamera: snapshot.canSwitchCamera,
        errorMessage: snapshot.errorMessage || state.errorMessage
      }));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setRuntime((state) => {
      const nextDirection =
        session == null
          ? null
          : resolveDirection(session, sessionUserId);
      return {
        ...state,
        direction: nextDirection,
        status: resolveRuntimeStatus(session, state.status)
      };
    });
  }, [session, sessionUserId]);

  useEffect(() => {
    if (!session) {
      return;
    }
    if (!terminalStatuses.has(session.status)) {
      return;
    }
    adapterRef.current.cleanup().catch(() => undefined);
    preparingCallIdRef.current = "";
    if (endTimeoutRef.current) {
      clearTimeout(endTimeoutRef.current);
    }
    endTimeoutRef.current = setTimeout(() => {
      setRuntime((state) => ({
        ...state,
        status: "idle"
      }));
    }, CALL_TIMEOUTS_MS.endedDismiss);
    return () => {
      if (endTimeoutRef.current) {
        clearTimeout(endTimeoutRef.current);
        endTimeoutRef.current = null;
      }
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      adapterRef.current.setSessionContext(null).catch(() => undefined);
      return;
    }
    const direction = resolveDirection(session, sessionUserId);
    const targetUserId = resolveTargetUserId(session, sessionUserId);
    adapterRef.current
      .setSessionContext({
        callId: session.id,
        callType: session.callType,
        direction,
        status: session.status,
        targetUserId: targetUserId || undefined
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to synchronize call session state.";
        applyRuntimeError(message);
      });
  }, [applyRuntimeError, session, sessionUserId]);

  useEffect(() => {
    if (!latestSignal) {
      return;
    }
    if (!session) {
      return;
    }
    if (latestSignal.callId !== session.id) {
      return;
    }
    adapterRef.current
      .handleInboundSignal(latestSignal)
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to process incoming WebRTC signaling.";
        callLogger.error("controller.handleInboundSignal failed", message);
        applyRuntimeError(message);
      })
      .finally(() => {
        clearLatestSignal();
      });
  }, [applyRuntimeError, clearLatestSignal, latestSignal, session]);

  useEffect(() => {
    const adapter = adapterRef.current;
    return () => {
      adapter.cleanup().catch(() => undefined);
      if (endTimeoutRef.current) {
        clearTimeout(endTimeoutRef.current);
        endTimeoutRef.current = null;
      }
    };
  }, []);

  const prepareLocalMedia = useCallback(
    async (targetSession: CallSession | null, mode: "start" | "join") => {
      const callType = targetSession?.callType ?? "audio";
      const permissions = await requestForCallType(callType);
      if (!permissions.granted) {
        applyRuntimeError(permissions.errorMessage || "Required media permissions were denied.");
        throw new Error(permissions.errorMessage || "Required media permissions were denied.");
      }

      try {
        await adapterRef.current.ensureReady(callType);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "WebRTC stack is not configured yet.";
        callLogger.warn(`controller.prepareLocalMedia(${mode})`, message);
        applyRuntimeError(message);
        throw new Error(message);
      }
    },
    [applyRuntimeError, requestForCallType]
  );

  useEffect(() => {
    if (!session) {
      preparingCallIdRef.current = "";
      return;
    }
    if (!liveStatuses.has(session.status)) {
      preparingCallIdRef.current = "";
      return;
    }
    if (runtime.localMedia.hasStream) {
      preparingCallIdRef.current = session.id;
      return;
    }
    if (
      session.status === "ringing" &&
      resolveDirection(session, sessionUserId) === "incoming"
    ) {
      return;
    }
    if (preparingCallIdRef.current === session.id) {
      return;
    }

    preparingCallIdRef.current = session.id;
    prepareLocalMedia(session, "join").catch((error) => {
      preparingCallIdRef.current = "";
      const message =
        error instanceof Error ? error.message : "Unable to initialize local media.";
      callLogger.warn("controller.autoPrepareLocalMedia failed", message);
    });
  }, [prepareLocalMedia, runtime.localMedia.hasStream, session, sessionUserId]);

  const startOutgoingCall = useCallback(
    async (request: OutgoingCallRequest): Promise<string> => {
      setLoading(true);
      try {
        const callIdValue = await startCall(request);
        const started =
          useCallsStore.getState().currentCall?.id === callIdValue
            ? useCallsStore.getState().currentCall
            : null;
        setRuntime((state) => ({
          ...state,
          status: "calling",
          direction: "outgoing",
          errorMessage: ""
        }));
        preparingCallIdRef.current = callIdValue;
        await prepareLocalMedia(started, "start");
        return callIdValue;
      } catch (error) {
        preparingCallIdRef.current = "";
        const message = error instanceof Error ? error.message : "Unable to start call.";
        applyRuntimeError(message);
        setRuntime((state) => ({
          ...state,
          status: "failed"
        }));
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [applyRuntimeError, prepareLocalMedia, startCall]
  );

  const joinCallById = useCallback(
    async (targetCallId: string): Promise<void> => {
      setLoading(true);
      try {
        await loadCallById(targetCallId);
        const loadedCall = useCallsStore.getState().currentCall;
        setRuntime((state) => ({
          ...state,
          status: loadedCall?.status ?? "connecting"
        }));
        if (
          loadedCall &&
          (loadedCall.status === "calling" ||
            loadedCall.status === "ringing" ||
            loadedCall.status === "connecting" ||
            loadedCall.status === "connected")
        ) {
          preparingCallIdRef.current = targetCallId;
          await prepareLocalMedia(loadedCall, "join");
        }
      } catch (error) {
        preparingCallIdRef.current = "";
        const message = error instanceof Error ? error.message : "Unable to join call.";
        applyRuntimeError(message);
        setRuntime((state) => ({
          ...state,
          status: "failed"
        }));
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [applyRuntimeError, loadCallById, prepareLocalMedia]
  );

  const acceptIncomingCall = useCallback(
    async (targetCallId: string): Promise<void> => {
      const targetSession =
        (session?.id === targetCallId ? session : null) ??
        useCallsStore.getState().history.find((row) => row.id === targetCallId) ??
        null;
      preparingCallIdRef.current = targetCallId;
      await prepareLocalMedia(targetSession, "join");
      acceptCall(targetCallId);
      setRuntime((state) => ({
        ...state,
        status: "connecting",
        direction: "incoming"
      }));
    },
    [acceptCall, prepareLocalMedia, session]
  );

  const declineIncomingCall = useCallback(
    async (targetCallId: string): Promise<void> => {
      rejectCall(targetCallId);
      await adapterRef.current.cleanup().catch(() => undefined);
      preparingCallIdRef.current = "";
      setRuntime((state) => ({
        ...state,
        status: "declined"
      }));
    },
    [rejectCall]
  );

  const endCall = useCallback(
    async (targetCallId: string): Promise<void> => {
      endCallFromStore(targetCallId);
      await adapterRef.current.cleanup().catch(() => undefined);
      preparingCallIdRef.current = "";
      setRuntime((state) => ({
        ...state,
        status: "ended"
      }));
    },
    [endCallFromStore]
  );

  const toggleMute = useCallback(async (): Promise<void> => {
    try {
      const nextMuted = !runtime.isMuted;
      await adapterRef.current.toggleMute(nextMuted);
    } catch (error) {
      applyRuntimeError(error instanceof Error ? error.message : "Unable to toggle microphone.");
    }
  }, [applyRuntimeError, runtime.isMuted]);

  const toggleCamera = useCallback(async (): Promise<void> => {
    try {
      const nextEnabled = !runtime.isCameraEnabled;
      await adapterRef.current.toggleCamera(nextEnabled);
    } catch (error) {
      applyRuntimeError(error instanceof Error ? error.message : "Unable to toggle camera.");
    }
  }, [applyRuntimeError, runtime.isCameraEnabled]);

  const switchCamera = useCallback(async (): Promise<void> => {
    try {
      await adapterRef.current.switchCamera();
    } catch (error) {
      applyRuntimeError(error instanceof Error ? error.message : "Unable to switch camera.");
    }
  }, [applyRuntimeError]);

  const toggleSpeaker = useCallback(async (): Promise<void> => {
    try {
      const nextEnabled = !runtime.speakerEnabled;
      await adapterRef.current.toggleSpeaker(nextEnabled);
    } catch (error) {
      applyRuntimeError(error instanceof Error ? error.message : "Unable to toggle speaker.");
    }
  }, [applyRuntimeError, runtime.speakerEnabled]);

  const clearError = useCallback(() => {
    setRuntime((state) => ({
      ...state,
      errorMessage: "",
      localMedia: {
        ...state.localMedia,
        errorMessage: ""
      }
    }));
  }, []);

  const resetRuntime = useCallback(() => {
    setRuntime(initialRuntimeState);
  }, []);

  return {
    session,
    runtime,
    incomingFromUserId,
    loading: loading || loadingHistory,
    startOutgoingCall,
    joinCallById,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleSpeaker,
    clearError,
    resetRuntime
  };
};
