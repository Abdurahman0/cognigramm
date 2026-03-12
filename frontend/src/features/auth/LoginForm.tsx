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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username or Email</label>
        <input
          {...register("identifier", { required: true })}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="alice"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
        <input
          {...register("password", { required: true })}
          type="password"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="********"
        />
      </div>
      <button
        disabled={submitting || formState.isSubmitting}
        className="w-full rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-700 disabled:opacity-50"
      >
        {submitting ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
