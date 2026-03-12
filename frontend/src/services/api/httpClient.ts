import axios, { AxiosError } from "axios";

import type { ApiErrorPayload } from "@/types/api";
import { API_BASE_URL } from "@/utils/constants";
import { clearTokens, getStoredToken, storeTokens } from "@/utils/token";

let refreshPromise: Promise<string | null> | null = null;

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

httpClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const original = error.config;
    if (!original) {
      return Promise.reject(error);
    }
    const isAuthError = error.response?.status === 401;
    const alreadyRetried = (original as { _retry?: boolean })._retry;
    if (!isAuthError || alreadyRetried) {
      return Promise.reject(error);
    }
    (original as { _retry?: boolean })._retry = true;
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken();
    }
    const token = await refreshPromise.finally(() => {
      refreshPromise = null;
    });
    if (!token) {
      return Promise.reject(error);
    }
    original.headers.Authorization = `Bearer ${token}`;
    return httpClient(original);
  }
);

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem("messenger_refresh_token") : null;
  if (!refreshToken) {
    clearTokens();
    return null;
  }
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 15000 }
    );
    const accessToken = response.data?.access_token as string | undefined;
    if (!accessToken) {
      clearTokens();
      return null;
    }
    storeTokens(accessToken, refreshToken);
    return accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

export function extractApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}
