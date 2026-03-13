import type { ID } from "@/types/common";

export type CallDirection = "incoming" | "outgoing";
export type CallResult = "answered" | "missed" | "rejected";
export type CallMode = "voice" | "video";

export interface CallLogItem {
  id: ID;
  participantId: ID;
  direction: CallDirection;
  result: CallResult;
  mode: CallMode;
  createdAt: string;
  durationLabel: string;
}
