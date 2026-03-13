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
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        {...register("username", { required: true })}
        className="w-full rounded-lg border border-[#ccd0d5] bg-[#f5f6f7] px-4 py-3 text-[15px] text-[#1c1e21] outline-none transition focus:border-[#0084ff] focus:bg-white focus:ring-2 focus:ring-[#0084ff]/20 placeholder:text-[#90949c]"
        placeholder="Username"
      />
      <input
        {...register("email", { required: true })}
        type="email"
        className="w-full rounded-lg border border-[#ccd0d5] bg-[#f5f6f7] px-4 py-3 text-[15px] text-[#1c1e21] outline-none transition focus:border-[#0084ff] focus:bg-white focus:ring-2 focus:ring-[#0084ff]/20 placeholder:text-[#90949c]"
        placeholder="Email address"
      />
      <input
        {...register("password", { required: true, minLength: 8 })}
        type="password"
        className="w-full rounded-lg border border-[#ccd0d5] bg-[#f5f6f7] px-4 py-3 text-[15px] text-[#1c1e21] outline-none transition focus:border-[#0084ff] focus:bg-white focus:ring-2 focus:ring-[#0084ff]/20 placeholder:text-[#90949c]"
        placeholder="New password (min 8 characters)"
      />
      <button
        disabled={submitting || formState.isSubmitting}
        className="w-full rounded-lg bg-[#00c74a] px-4 py-3 text-[17px] font-bold text-white transition hover:bg-[#00b341] active:bg-[#009f3a] disabled:opacity-60"
      >
        {submitting ? "Creating..." : "Sign Up"}
      </button>
    </form>
  );
}
