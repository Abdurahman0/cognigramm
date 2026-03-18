import type { BackendCallState, CallDirection, CallStatus } from "@/features/calls/types";

export const mapBackendStateToStatus = (
  state: BackendCallState,
  direction: CallDirection
): CallStatus => {
  if (state === "ringing") {
    return direction === "outgoing" ? "calling" : "ringing";
  }
  if (state === "active") {
    return "connected";
  }
  if (state === "missed") {
    return "missed";
  }
  if (state === "rejected" || state === "cancelled") {
    return "declined";
  }
  if (state === "failed") {
    return "failed";
  }
  return "ended";
};
