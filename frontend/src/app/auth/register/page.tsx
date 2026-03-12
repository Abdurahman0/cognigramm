import Link from "next/link";

import { RegisterForm } from "@/features/auth/RegisterForm";

export default function RegisterPage(): JSX.Element {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Start messaging in realtime across all your devices.</p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        Already registered?{" "}
        <Link href="/auth/login" className="font-semibold text-accent-700 hover:underline dark:text-accent-300">
          Sign in
        </Link>
      </p>
    </section>
  );
}
