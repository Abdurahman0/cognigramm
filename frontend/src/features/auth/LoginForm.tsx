"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authErrorMessage, loginAction } from "@/features/auth/authActions";

interface Vals { identifier: string; password: string; }

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit } = useForm<Vals>({ defaultValues: { identifier: "", password: "" } });

  const onSubmit = handleSubmit(async (vals) => {
    setBusy(true);
    try {
      await loginAction(vals);
      router.replace("/chat");
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        {...register("identifier", { required: true })}
        placeholder="Username or Email"
        className="w-full rounded-lg border px-4 py-3 text-[15px] outline-none transition"
        style={{
          borderColor: "#ccd0d5",
          background: "#f5f6f7",
          color: "#1c1e21",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#0084ff";
          e.currentTarget.style.background = "#fff";
          e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,132,255,.2)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#ccd0d5";
          e.currentTarget.style.background = "#f5f6f7";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <input
        {...register("password", { required: true })}
        type="password"
        placeholder="Password"
        className="w-full rounded-lg border px-4 py-3 text-[15px] outline-none transition"
        style={{ borderColor: "#ccd0d5", background: "#f5f6f7", color: "#1c1e21" }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#0084ff";
          e.currentTarget.style.background = "#fff";
          e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,132,255,.2)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#ccd0d5";
          e.currentTarget.style.background = "#f5f6f7";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button
        disabled={busy}
        className="w-full rounded-lg py-3 text-[17px] font-bold text-white transition"
        style={{ background: busy ? "#4da6ff" : "#0084ff" }}
      >
        {busy ? "Signing in…" : "Log In"}
      </button>
    </form>
  );
}
