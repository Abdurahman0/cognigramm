export default function AuthLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/80 p-8 shadow-soft-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        {children}
      </div>
    </main>
  );
}
