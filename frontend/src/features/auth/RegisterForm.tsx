"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authErrorMessage, registerAction } from "@/features/auth/authActions";

interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
}

export function RegisterForm(): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState } = useForm<RegisterFormValues>({
    defaultValues: {
      username: "",
      email: "",
      password: ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await registerAction(values);
      toast.success("Account created");
      router.replace("/auth/login");
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
        <input
          {...register("username", { required: true })}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="alice"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
        <input
          {...register("email", { required: true })}
          type="email"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="alice@example.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
        <input
          {...register("password", { required: true, minLength: 8 })}
          type="password"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="********"
        />
      </div>
      <button
        disabled={submitting || formState.isSubmitting}
        className="w-full rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-700 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Account"}
      </button>
    </form>
  );
}
