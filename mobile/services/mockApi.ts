import { CURRENT_USER_ID, mockUsers } from "@/mock";
import type { AuthSession, LoginPayload, OtpPayload, RegisterPayload, User } from "@/types";
import { createId } from "@/utils/ids";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockLogin(payload: LoginPayload): Promise<AuthSession> {
  await wait(800);
  const user = mockUsers.find((candidate) => candidate.email.toLowerCase() === payload.email.toLowerCase());
  if (!user || payload.password.length < 6) {
    throw new Error("Invalid credentials. Use a company email and password.");
  }
  return {
    userId: user.id,
    token: createId("token")
  };
}

export async function mockRegister(payload: RegisterPayload): Promise<User> {
  await wait(900);
  const exists = mockUsers.some((user) => user.email.toLowerCase() === payload.email.toLowerCase());
  if (exists) {
    throw new Error("Employee account already exists with this email.");
  }

  return {
    id: createId("user"),
    fullName: payload.fullName,
    email: payload.email.toLowerCase(),
    avatar: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop",
    role: "intern",
    department: "Engineering",
    title: payload.department ? `${payload.department} Member` : "Team Member",
    presence: "available",
    isOnline: true,
    about: "New team member profile.",
    timezone: "Asia/Tashkent"
  };
}

export async function mockRequestOtp(email: string): Promise<{ challengeId: string }> {
  await wait(650);
  if (!email.includes("@")) {
    throw new Error("Enter a valid work email.");
  }
  return { challengeId: createId("otp") };
}

export async function mockVerifyOtp(payload: OtpPayload): Promise<AuthSession> {
  await wait(700);
  if (payload.code !== "123456") {
    throw new Error("Incorrect verification code. Use 123456 for demo.");
  }
  const user =
    mockUsers.find((candidate) => candidate.email.toLowerCase() === payload.email.toLowerCase()) ??
    mockUsers.find((candidate) => candidate.id === CURRENT_USER_ID);
  return {
    userId: user?.id ?? CURRENT_USER_ID,
    token: createId("token")
  };
}
