"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authErrorMessage, loginAction } from "@/features/auth/authActions";

interface LoginFormValues {
  identifier: string;
  password: string;
}

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState } = useForm<LoginFormValues>({
    defaultValues: {
      identifier: "",
      password: ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await loginAction(values);
      toast.success("Welcome back");
      router.replace("/chat");
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        {...register("identifier", { required: true })}
        className="w-full rounded-lg border border-[#ccd0d5] bg-[#f5f6f7] px-4 py-3 text-[15px] text-[#1c1e21] outline-none transition focus:border-[#0084ff] focus:bg-white focus:ring-2 focus:ring-[#0084ff]/20 placeholder:text-[#90949c]"
        placeholder="Username or Email"
      />
      <input
        {...register("password", { required: true })}
        type="password"
        className="w-full rounded-lg border border-[#ccd0d5] bg-[#f5f6f7] px-4 py-3 text-[15px] text-[#1c1e21] outline-none transition focus:border-[#0084ff] focus:bg-white focus:ring-2 focus:ring-[#0084ff]/20 placeholder:text-[#90949c]"
        placeholder="Password"
      />
      <button
        disabled={submitting || formState.isSubmitting}
        className="w-full rounded-lg bg-[#0084ff] px-4 py-3 text-[17px] font-bold text-white transition hover:bg-[#0073e6] active:bg-[#006be0] disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Log In"}
      </button>
    </form>
  );
}
