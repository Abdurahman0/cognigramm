"use client";

import { formatLastSeen } from "@/utils/date";

interface UserPresenceBadgeProps {
  isOnline: boolean;
  lastSeen: string | null | undefined;
  compact?: boolean;
}

export function UserPresenceBadge({ isOnline, lastSeen, compact = false }: UserPresenceBadgeProps): JSX.Element {
  if (compact) {
    return (
      <span
        className={`inline-block h-3 w-3 rounded-full border-2 border-[var(--background)] ${isOnline ? "bg-[var(--messenger-online)]" : "bg-slate-300 dark:bg-slate-600"}`}
      />
    );
  }
  return (
    <span className={`text-xs ${isOnline ? "text-[var(--messenger-online)]" : "text-[var(--muted)]"}`}>
      {isOnline ? "Active now" : formatLastSeen(lastSeen)}
    </span>
  );
}
