export default function AuthLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f0f2f5] px-4 py-8">
      {/* Messenger logo */}
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[#0084ff] shadow-lg">
          <svg viewBox="0 0 48 48" fill="none" className="h-11 w-11" aria-hidden="true">
            <path
              d="M24 4C13 4 4 12.5 4 23c0 5.8 2.7 11 7 14.6V44l6.3-3.5C19.1 41.1 21.5 41.5 24 41.5c11 0 20-8.5 20-18.5S35 4 24 4z"
              fill="#ffffff"
            />
            <path
              d="M11 28l7-7.5 3.5 3.5 6.5-7 7 7.5-6.5 7-3.5-3.5L11 28z"
              fill="#0084ff"
            />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-[#0084ff]">Messenger</h1>
      </div>

      <div className="w-full max-w-[396px] rounded-lg bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
        {children}
      </div>
    </main>
  );
}
