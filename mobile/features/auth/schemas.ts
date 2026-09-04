import { z } from "zod";

import { USE_MOCK_API } from "@/services/api/config";

/**
 * Against the in-app mock there is no account to get wrong, so the form only asks for
 * something rather than a well-formed address and an eight-character password. The real
 * rules come back the moment the build points at the API.
 */
const email = USE_MOCK_API
  ? z.string().min(1, "Enter anything to continue")
  : z.string().email("Enter a valid work email");
const password = USE_MOCK_API
  ? z.string().min(1, "Enter anything to continue")
  : z.string().min(8, "Password must be at least 8 characters");

export const loginSchema = z.object({
  email,
  password
});

export const registerSchema = z
  .object({
    fullName: z.string().min(3, "Full name is required"),
    email,
    department: z.string().min(2, "Department is required"),
    password,
    confirmPassword: USE_MOCK_API
      ? z.string().min(1, "Confirm your password")
      : z.string().min(8, "Confirm your password")
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
