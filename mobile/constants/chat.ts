import type { UserPresence } from "@/types";

export const CHAT_FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "groups", label: "Groups" }
] as const;

export const PRESENCE_LABELS: Record<UserPresence, string> = {
  available: "Available",
  in_meeting: "In meeting",
  busy: "Busy",
  on_break: "On break",
  offline: "Offline",
  remote: "Remote"
};
