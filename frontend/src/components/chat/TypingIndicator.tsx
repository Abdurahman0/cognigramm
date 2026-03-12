"use client";

interface TypingIndicatorProps {
  usernames: string[];
}

export function TypingIndicator({ usernames }: TypingIndicatorProps): JSX.Element | null {
  if (usernames.length === 0) {
    return null;
  }
  const label = usernames.length === 1 ? `${usernames[0]} is typing...` : `${usernames.slice(0, 2).join(", ")} are typing...`;
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:100ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:200ms]" />
      </span>
      <span>{label}</span>
    </div>
  );
}
