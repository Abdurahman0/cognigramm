"use client";

import { authApi, extractApiErrorMessage, usersApi } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";
import type { LoginPayload, RegisterPayload } from "@/types/auth";

export async function loginAction(payload: LoginPayload): Promise<void> {
  const response = await authApi.login(payload);
  const accessToken = response.access_token;
  const refreshToken = response.refresh_token || null;
  useAuthStore.getState().setTokens(accessToken, refreshToken);
  const me = await usersApi.me();
  useUserStore.getState().setCurrentUser(me);
}

export async function registerAction(payload: RegisterPayload): Promise<void> {
  await authApi.register(payload);
}

export function authErrorMessage(error: unknown): string {
  return extractApiErrorMessage(error);
}
