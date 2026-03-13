"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authErrorMessage, registerAction } from "@/features/auth/authActions";

interface Vals { username: string; email: string; password: string; }

const inputClass = "w-full rounded-lg border px-4 py-3 text-[15px] outline-none transition";
const inputStyle = { borderColor: "#ccd0d5", background: "#f5f6f7", color: "#1c1e21" };
const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#0084ff";
  e.currentTarget.style.background = "#fff";
  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,132,255,.2)";
};
const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "#ccd0d5";
  e.currentTarget.style.background = "#f5f6f7";
  e.currentTarget.style.boxShadow = "none";
};

export function RegisterForm(): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit } = useForm<Vals>({ defaultValues: { username: "", email: "", password: "" } });

  const onSubmit = handleSubmit(async (vals) => {
    setBusy(true);
    try {
      await registerAction(vals);
      toast.success("Account created — please log in");
      router.replace("/auth/login");
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input {...register("username", { required: true })} placeholder="Username" className={inputClass} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <input {...register("email", { required: true })} type="email" placeholder="Email address" className={inputClass} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <input {...register("password", { required: true, minLength: 8 })} type="password" placeholder="New password (min 8 chars)" className={inputClass} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <button
        disabled={busy}
        className="w-full rounded-lg py-3 text-[17px] font-bold text-white transition"
        style={{ background: busy ? "#00b341" : "#00c74a" }}
      >
        {busy ? "Creating…" : "Sign Up"}
      </button>
    </form>
  );
}
