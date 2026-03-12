export function EmptyState({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}
