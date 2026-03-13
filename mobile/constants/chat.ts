import type { MessagePriority, UserPresence } from "@/types";

export const CHAT_FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "channels", label: "Channels" },
  { key: "groups", label: "Groups" },
  { key: "archived", label: "Archived" }
] as const;

export const PRIORITY_LABELS: Record<MessagePriority, string> = {
  normal: "Normal",
  important: "Important",
  urgent: "Urgent"
};

export const PRESENCE_LABELS: Record<UserPresence, string> = {
  available: "Available",
  in_meeting: "In meeting",
  busy: "Busy",
  on_break: "On break",
  offline: "Offline",
  remote: "Remote"
};
