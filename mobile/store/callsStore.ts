import { create } from "zustand";

import { mapApiCallToCallSession } from "@/services/api/adapters";
import { callsApi, type ApiSocketEnvelope } from "@/services/api";
import { signalingAdapter } from "@/features/calls/services/signalingAdapter";
import { formatCallDuration, getCallDurationMs } from "@/features/calls/utils/formatCallDuration";
import { mapBackendStateToStatus } from "@/features/calls/utils/statusMapper";
import { callLogger } from "@/features/calls/utils/callLogger";
import { useAuthStore } from "@/store/authStore";
import type {
  CallSignalEnvelope,
  CallState,
  CallSession,
  OutgoingCallRequest
} from "@/types";
import { createId } from "@/utils/ids";

interface CallsStore {
  history: CallSession[];
  total: number;
  loadingHistory: boolean;
  currentCall: CallSession | null;
  incomingFromUserId: string;
  latestSignal: CallSignalEnvelope | null;
  lastError: string;
  initializeForSession: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  loadCallById: (callId: string) => Promise<void>;
  startCall: (payload: OutgoingCallRequest) => Promise<string>;
  acceptCall: (callId: string) => void;
  rejectCall: (callId: string) => void;
  endCall: (callId: string) => void;
  clearLatestSignal: () => void;
  clearError: () => void;
  clear: () => void;
  handleSocketEvent: (envelope: ApiSocketEnvelope) => void;
}

const HISTORY_PAGE_LIMIT = 30;
const terminalStates = new Set<CallSession["status"]>([
  "ended",
  "declined",
  "failed",
  "missed"
]);

const formatTerminalCallSummary = (session: CallSession): string => {
  const callLabel = session.callType === "video" ? "Video call" : "Audio call";
  if (session.status === "declined") {
    return `${callLabel} declined`;
  }
  if (session.status === "missed") {
    return `${callLabel} missed`;
  }
  if (session.status === "failed") {
    return `${callLabel} failed`;
  }

  const durationMs = getCallDurationMs(session);
  if (durationMs > 0) {
    return `${callLabel} ended (${formatCallDuration(durationMs)})`;
  }
  return `${callLabel} ended`;
};

const appendCallSummaryToConversation = (session: CallSession): void => {
  if (!terminalStates.has(session.status)) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chatModule = require("@/store/chatStore") as {
      useChatStore: {
        getState: () => {
          appendSystemMessage?: (payload: {
            chatId: string;
            body: string;
            messageId?: string;
            createdAt?: string;
          }) => void;
        };
      };
    };
    chatModule.useChatStore.getState().appendSystemMessage?.({
      chatId: session.conversationId,
      body: formatTerminalCallSummary(session),
      messageId: `call_summary_${session.id}_${session.status}`,
      createdAt: session.endedAt ?? session.updatedAt
    });
  } catch (error) {
    callLogger.warn("calls.appendCallSummary failed", error);
  }
};

const parseNumericId = (value: string | number | null | undefined): number | null => {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const withSession = (): { token: string; userId: string } => {
  const session = useAuthStore.getState().session;
  if (!session) {
    throw new Error("Missing session");
  }
  return {
    token: session.token,
    userId: session.userId
  };
};

const sortCalls = (rows: CallSession[]): CallSession[] =>
  [...rows].sort((a, b) => {
    const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
    if (byUpdated !== 0) {
      return byUpdated;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

const upsertCall = (rows: CallSession[], incoming: CallSession): CallSession[] => {
  const index = rows.findIndex((row) => row.id === incoming.id);
  if (index < 0) {
    return sortCalls([incoming, ...rows]);
  }
  const next = [...rows];
  next[index] = incoming;
  return sortCalls(next);
};

const updateCallStateById = (
  rows: CallSession[],
  callId: string,
  state: CallState
): CallSession[] => {
  let changed = false;
  const now = new Date().toISOString();
  const next = rows.map((row) => {
    if (row.id !== callId) {
      return row;
    }
    changed = true;
    return {
      ...row,
      state,
      status: mapBackendStateToStatus(state, row.direction),
      updatedAt: now,
      endedAt:
        state === "ended" || state === "failed" || state === "missed"
          ? now
          : row.endedAt
    };
  });
  return changed ? sortCalls(next) : rows;
};

export const useCallsStore = create<CallsStore>((set, get) => ({
  history: [],
  total: 0,
  loadingHistory: false,
  currentCall: null,
  incomingFromUserId: "",
  latestSignal: null,
  lastError: "",
  initializeForSession: async () => {
    const session = useAuthStore.getState().session;
    if (!session) {
      get().clear();
      return;
    }
    await get().refreshHistory();
  },
  refreshHistory: async () => {
    const session = useAuthStore.getState().session;
    if (!session) {
      get().clear();
      return;
    }
    set({ loadingHistory: true });
    try {
      const response = await callsApi.getHistory(session.token, {
        limit: HISTORY_PAGE_LIMIT,
        offset: 0
      });
      const mapped = response.calls.map((call) =>
        mapApiCallToCallSession(call, session.userId)
      );
      set((state) => {
        const history = sortCalls(mapped);
        const currentCall =
          state.currentCall && !terminalStates.has(state.currentCall.status)
            ? history.find((row) => row.id === state.currentCall?.id) ?? state.currentCall
            : state.currentCall;
        return {
          history,
          total: response.total,
          currentCall
        };
      });
    } finally {
      set({ loadingHistory: false });
    }
  },
  loadCallById: async (callId) => {
    const { token, userId } = withSession();
    const apiCall = await callsApi.getById(token, callId);
    const mapped = mapApiCallToCallSession(apiCall, userId);
    set((state) => ({
      currentCall: mapped,
      incomingFromUserId: mapped.direction === "incoming" ? mapped.initiatorId : "",
      history: upsertCall(state.history, mapped),
      lastError: ""
    }));
  },
  startCall: async (payload) => {
    const { userId } = withSession();
    const conversationId = parseNumericId(payload.conversationId);
    if (!conversationId) {
      throw new Error("Invalid conversation id.");
    }
    const callId = payload.callId?.trim() || createId("call");
    const now = new Date().toISOString();
    const optimistic: CallSession = {
      id: callId,
      conversationId: String(conversationId),
      initiatorId: userId,
      callType: payload.callType,
      state: "ringing",
      status: "calling",
      direction: "outgoing",
      createdAt: now,
      updatedAt: now,
      participants: [
        {
          userId,
          state: "invited",
          isOnlineWhenInvited: true,
          createdAt: now
        }
      ]
    };

    set((state) => ({
      currentCall: optimistic,
      incomingFromUserId: "",
      history: upsertCall(state.history, optimistic),
      lastError: ""
    }));

    signalingAdapter.sendStartCall({
      conversationId,
      callType: payload.callType,
      callId
    });
    return callId;
  },
  acceptCall: (callId) => {
    signalingAdapter.sendAcceptCall({ callId });
    set((state) => ({
      currentCall:
        state.currentCall?.id === callId
          ? {
              ...state.currentCall,
              status: "connecting",
              updatedAt: new Date().toISOString()
            }
          : state.currentCall,
      incomingFromUserId:
        state.currentCall?.id === callId ? "" : state.incomingFromUserId,
      lastError: ""
    }));
  },
  rejectCall: (callId) => {
    signalingAdapter.sendDeclineCall({ callId });
    set((state) => ({
      currentCall:
        state.currentCall?.id === callId
          ? {
              ...state.currentCall,
              state: "rejected",
              status: "declined",
              updatedAt: new Date().toISOString()
            }
          : state.currentCall,
      history: updateCallStateById(state.history, callId, "rejected"),
      incomingFromUserId:
        state.currentCall?.id === callId ? "" : state.incomingFromUserId,
      lastError: ""
    }));
    const declined =
      get().currentCall?.id === callId
        ? get().currentCall
        : get().history.find((row) => row.id === callId) ?? null;
    if (declined) {
      appendCallSummaryToConversation(declined);
    }
  },
  endCall: (callId) => {
    signalingAdapter.sendEndCall({ callId });
    set((state) => ({
      currentCall:
        state.currentCall?.id === callId
          ? {
              ...state.currentCall,
              state: "ended",
              status: "ended",
              endedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          : state.currentCall,
      history: updateCallStateById(state.history, callId, "ended"),
      incomingFromUserId:
        state.currentCall?.id === callId ? "" : state.incomingFromUserId,
      lastError: ""
    }));
    const ended =
      get().currentCall?.id === callId
        ? get().currentCall
        : get().history.find((row) => row.id === callId) ?? null;
    if (ended) {
      appendCallSummaryToConversation(ended);
    }
  },
  clearLatestSignal: () => {
    set({ latestSignal: null });
  },
  clearError: () => {
    set({ lastError: "" });
  },
  clear: () => {
    set({
      history: [],
      total: 0,
      loadingHistory: false,
      currentCall: null,
      incomingFromUserId: "",
      latestSignal: null,
      lastError: ""
    });
  },
  handleSocketEvent: (envelope) => {
    const incoming = signalingAdapter.parseInboundEnvelope(envelope);
    if (!incoming) {
      return;
    }
    callLogger.debug("socket.inbound", incoming.type);

    if (incoming.type === "webrtc:signal") {
      set({
        latestSignal: incoming.payload
      });
      return;
    }

    if (incoming.type === "call:error") {
      set({
        lastError: incoming.detail
      });
      return;
    }

    const incomingSession = incoming.payload.session;
    set((state) => ({
      currentCall: incomingSession,
      incomingFromUserId:
        incoming.type === "call:incoming"
          ? incoming.payload.actorUserId ?? incomingSession.initiatorId
          : "",
      history: upsertCall(state.history, incomingSession),
      lastError: ""
    }));

    if (terminalStates.has(incomingSession.status)) {
      appendCallSummaryToConversation(incomingSession);
      get().refreshHistory().catch(() => undefined);
    }
  }
}));
