import Link from "next/link";

import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage(): JSX.Element {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Sign In</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Connect to your distributed messenger workspace.</p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        New user?{" "}
        <Link href="/auth/register" className="font-semibold text-accent-700 hover:underline dark:text-accent-300">
          Create account
        </Link>
      </p>
    </section>
  );
}
