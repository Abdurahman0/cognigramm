export default function AuthLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10"
      style={{ background: "#f0f2f5" }}
    >
      {/* Logo */}
      <div className="mb-5 flex flex-col items-center gap-2">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full shadow-lg"
          style={{ background: "#0084ff" }}
        >
          <svg viewBox="0 0 48 48" fill="none" className="h-11 w-11">
            <path
              d="M24 4C13 4 4 12.5 4 23c0 5.8 2.7 11 7 14.6V44l6.3-3.5C19.1 41.1 21.5 41.5 24 41.5c11 0 20-8.5 20-18.5S35 4 24 4z"
              fill="#fff"
            />
            <path
              d="M11.5 29l7-7.5 3.5 3.5 6.5-7 7 7.5-6.5 7-3.5-3.5L11.5 29z"
              fill="#0084ff"
            />
          </svg>
        </div>
        <span className="text-4xl font-bold" style={{ color: "#0084ff" }}>
          Messenger
        </span>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-[396px] rounded-xl p-6"
        style={{ background: "#ffffff", boxShadow: "0 2px 16px rgba(0,0,0,.15)" }}
      >
        {children}
      </div>
    </main>
  );
}
