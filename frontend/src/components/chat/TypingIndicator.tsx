"use client";

interface Props {
  usernames: string[];
}

export function TypingIndicator({ usernames }: Props): JSX.Element | null {
  if (!usernames.length) return null;

  const label =
    usernames.length === 1
      ? usernames[0]
      : usernames.length === 2
      ? `${usernames[0]} and ${usernames[1]}`
      : `${usernames[0]} and others`;

  return (
    <div className="flex items-end gap-1.5 px-4 py-1">
      {/* Tiny avatar */}
      <div
        className="mb-0.5 h-7 w-7 shrink-0 rounded-full"
        style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
      />

      <div className="flex flex-col items-start gap-0.5">
        {/* Dots bubble */}
        <div
          className="flex items-center gap-[5px] rounded-[18px] rounded-bl-[4px] px-4 py-3"
          style={{ background: "var(--bubble-recv)" }}
        >
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full"
              style={{
                background: "var(--fg-secondary)",
                animation: `bounce 1.2s ${delay}ms infinite`,
              }}
            />
          ))}
        </div>
        <p className="ml-1 text-[11px]" style={{ color: "var(--fg-secondary)" }}>
          {label} is typing…
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
