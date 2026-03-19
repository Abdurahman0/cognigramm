import type { CallSession } from "@/features/calls/types";

interface CallDurationSource {
  startedAt?: CallSession["startedAt"];
  endedAt?: CallSession["endedAt"];
  status?: CallSession["status"];
}

const parseTimestamp = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const getCallDurationMs = (
  source: CallDurationSource,
  nowMs: number = Date.now()
): number => {
  const startedMs = parseTimestamp(source.startedAt);
  if (startedMs == null) {
    return 0;
  }

  const endedMs = parseTimestamp(source.endedAt);
  const effectiveEndMs = endedMs ?? nowMs;
  if (effectiveEndMs <= startedMs) {
    return 0;
  }
  return effectiveEndMs - startedMs;
};

export const formatCallDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
