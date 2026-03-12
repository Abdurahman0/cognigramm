import { cn } from "@/utils/cn";

export function LoadingState({ className, label = "Loading..." }: { className?: string; label?: string }): JSX.Element {
  return (
    <div className={cn("flex items-center justify-center py-12 text-sm text-slate-500 dark:text-slate-400", className)}>
      <span className="animate-pulse">{label}</span>
    </div>
  );
}
