import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid work email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const registerSchema = z
  .object({
    fullName: z.string().min(3, "Full name is required"),
    email: z.string().email("Enter a valid work email"),
    department: z.string().min(2, "Department is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm your password")
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const forgotSchema = z.object({
  email: z.string().email("Enter your work email")
});

export const otpSchema = z.object({
  code: z
    .string()
    .min(6, "Code must be 6 digits")
    .max(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Only digits are allowed")
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ForgotFormValues = z.infer<typeof forgotSchema>;
export type OtpFormValues = z.infer<typeof otpSchema>;
