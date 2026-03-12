"use client";

import { create } from "zustand";

import { clearTokens, getStoredRefreshToken, getStoredToken, storeTokens } from "@/utils/token";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setTokens: (accessToken: string, refreshToken?: string | null) => void;
  hydrate: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,
  setTokens: (accessToken, refreshToken) => {
    storeTokens(accessToken, refreshToken);
    set({
      accessToken,
      refreshToken: refreshToken ?? getStoredRefreshToken(),
      isAuthenticated: true
    });
  },
  hydrate: () => {
    const accessToken = getStoredToken();
    const refreshToken = getStoredRefreshToken();
    set({
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken),
      isHydrated: true
    });
  },
  logout: () => {
    clearTokens();
    set({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: true
    });
  }
}));
