import Link from "next/link";

import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage(): JSX.Element {
  return (
    <section className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold text-[#050505]">Sign in to Messenger</h2>
        <p className="text-sm text-[#65676b]">Enter your credentials to continue</p>
      </div>
      <LoginForm />
      <div className="border-t border-[#e4e6ea] pt-4 text-center">
        <p className="text-sm text-[#65676b]">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-semibold text-[#0084ff] hover:underline">
            Create new account
          </Link>
        </p>
      </div>
    </section>
  );
}
