import { useEffect, useRef } from "react";

import { callTones } from "@/features/calls/services/callTones";
import type { CallStatus } from "@/features/calls/types";
import { useCallsStore } from "@/store/callsStore";

const TERMINAL: ReadonlySet<CallStatus> = new Set<CallStatus>([
  "ended",
  "failed",
  "declined",
  "missed"
]);

/**
 * Plays the call's audio feedback as its status changes.
 *
 * Dialling out gives you ringback so you know the other end is being rung, an inbound
 * call rings this device, connecting cuts the tone and blips, and hanging up blips down.
 * Mount this exactly once — it is driven by `currentCall`, so a second mount would play
 * every tone twice.
 */
export const useCallTones = (): void => {
  const call = useCallsStore((state) => state.currentCall);
  const status: CallStatus = call?.status ?? "idle";
  const direction = call?.direction ?? null;
  const previousStatus = useRef<CallStatus>("idle");

  useEffect(() => {
    const previous = previousStatus.current;
    if (previous === status) {
      return;
    }
    previousStatus.current = status;

    // "ringing" means the far end is ringing on an outgoing call, and this device is
    // ringing on an incoming one — the same status, two different sounds.
    if (status === "calling" || (status === "ringing" && direction === "outgoing")) {
      callTones.ringback();
      return;
    }
    if (status === "ringing" && direction === "incoming") {
      callTones.ringtone();
      return;
    }
    // Answering lands on "connecting" while media is negotiated; ringing has to stop
    // the instant you pick up, not when the media path finally opens.
    if (status === "connecting") {
      callTones.stop();
      return;
    }
    if (status === "connected") {
      callTones.connected();
      return;
    }
    if (TERMINAL.has(status)) {
      // Only sound the end if there was actually a call in progress to end.
      if (previous === "idle") {
        callTones.stop();
        return;
      }
      callTones.ended();
      return;
    }
    if (status === "idle") {
      callTones.stop();
    }
  }, [direction, status]);

  useEffect(
    () => () => {
      callTones.stop();
    },
    []
  );
};
