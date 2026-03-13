export function EmptyState({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <h3 className="text-[16px] font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="max-w-md text-[14px] text-[var(--muted)]">{description}</p>
    </div>
  );
}
