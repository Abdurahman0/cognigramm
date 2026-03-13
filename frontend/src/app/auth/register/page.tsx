import Link from "next/link";
import { RegisterForm } from "@/features/auth/RegisterForm";

export default function RegisterPage(): JSX.Element {
  return (
    <section className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold" style={{ color: "#050505" }}>Create a new account</h2>
        <p className="text-sm" style={{ color: "#65676b" }}>It&apos;s quick and easy.</p>
      </div>
      <RegisterForm />
      <div className="border-t pt-4 text-center" style={{ borderColor: "#e4e6ea" }}>
        <p className="text-sm" style={{ color: "#65676b" }}>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: "#0084ff" }}>
            Log in
          </Link>
        </p>
      </div>
    </section>
  );
}
