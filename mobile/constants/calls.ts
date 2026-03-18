import type { CallState, CallStatus, CallType } from "@/types";

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  audio: "Audio",
  video: "Video"
};

export const CALL_STATE_LABELS: Record<CallState, string> = {
  ringing: "Ringing",
  active: "Active",
  ended: "Ended",
  missed: "Missed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  failed: "Failed"
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  idle: "Idle",
  calling: "Calling...",
  ringing: "Incoming call",
  connecting: "Connecting...",
  connected: "Connected",
  ended: "Call ended",
  failed: "Call failed",
  declined: "Declined",
  missed: "Missed call"
};
