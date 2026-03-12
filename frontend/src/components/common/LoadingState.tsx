import { cn } from "@/utils/cn";

export function LoadingState({ className, label = "Loading..." }: { className?: string; label?: string }): JSX.Element {
  return (
    <div className={cn("flex items-center justify-center py-8 text-[14px] text-[var(--muted)]", className)}>
      <span className="animate-pulse">{label}</span>
    </div>
  );
}
