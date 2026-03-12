"use client";

interface TypingIndicatorProps {
  usernames: string[];
}

export function TypingIndicator({ usernames }: TypingIndicatorProps): JSX.Element | null {
  if (usernames.length === 0) {
    return null;
  }

  const label = usernames.length === 1
    ? usernames[0]
    : usernames.length === 2
      ? `${usernames[0]} and ${usernames[1]}`
      : `${usernames[0]} and others`;

  return (
    <div className="flex items-end gap-1.5 px-4 py-1">
      {/* Small avatar placeholder */}
      <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[#60a5fa] to-[#3b82f6]" />

      <div className="flex flex-col items-start gap-0.5">
        {/* Typing bubble */}
        <div className="flex items-center gap-1 rounded-[18px] rounded-bl-[4px] bg-[var(--messenger-bubble-received)] px-4 py-3">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: "150ms" }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="ml-1 text-[11px] text-[var(--muted)]">{label} is typing...</p>
      </div>
    </div>
  );
}
