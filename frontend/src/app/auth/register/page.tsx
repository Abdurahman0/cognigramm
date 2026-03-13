import Link from "next/link";

import { RegisterForm } from "@/features/auth/RegisterForm";

export default function RegisterPage(): JSX.Element {
  return (
    <section className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold text-[#050505]">Create a new account</h2>
        <p className="text-sm text-[#65676b]">It&apos;s quick and easy.</p>
      </div>
      <RegisterForm />
      <div className="border-t border-[#e4e6ea] pt-4 text-center">
        <p className="text-sm text-[#65676b]">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-[#0084ff] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </section>
  );
}
