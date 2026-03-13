import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { mapApiUserToUser } from "@/services/api/adapters";
import { authApi, usersApi } from "@/services/api";
import { ApiRequestError } from "@/services/api/httpClient";
import type { AsyncStatus, AuthSession, LoginPayload, RegisterPayload, User } from "@/types";

interface AuthState {
  hydrated: boolean;
  hasSeenOnboarding: boolean;
  session: AuthSession | null;
  currentUser: User;
  otpEmail: string;
  otpChallengeId: string;
  status: AsyncStatus;
  errorMessage: string;
  markHydrated: () => void;
  completeOnboarding: () => void;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  setCurrentUserFromApi: (token: string) => Promise<void>;
  logout: () => void;
}

const defaultUser: User = {
  id: "0",
  username: "member",
  fullName: "Team Member",
  email: "",
  avatar: "",
  role: "employee",
  department: "General",
  title: "Team Member",
  presence: "offline",
  isOnline: false,
  about: "",
  timezone: "UTC"
};

const toUsernameSeed = (email: string): string => {
  const local = email.split("@")[0] ?? "member";
  const normalized = local.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 32);
  return normalized.length >= 3 ? normalized : `member_${Date.now().toString(36).slice(-6)}`;
};

const unsupportedOtpError = () =>
  new Error("Password reset/OTP flow is not available from the current backend API.");

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hasSeenOnboarding: false,
      session: null,
      currentUser: defaultUser,
      otpEmail: "",
      otpChallengeId: "",
      status: "idle",
      errorMessage: "",
      markHydrated: () => set({ hydrated: true }),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      login: async (payload) => {
        set({ status: "loading", errorMessage: "" });
        try {
          const identifier = payload.email.trim();
          const tokenResponse = await authApi.login({
            identifier,
            password: payload.password
          });
          const token = tokenResponse.access_token;
          const apiUser = await usersApi.me(token);
          const user = mapApiUserToUser(apiUser);
          const session: AuthSession = {
            userId: String(apiUser.id),
            token
          };
          set({
            session,
            currentUser: user,
            status: "success",
            errorMessage: "",
            otpEmail: "",
            otpChallengeId: ""
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Login failed.";
          set({
            status: "error",
            errorMessage: message
          });
          throw error;
        }
      },
      register: async (payload) => {
        set({ status: "loading", errorMessage: "" });
        const email = payload.email.trim().toLowerCase();
        const password = payload.password;
        const usernameSeed = toUsernameSeed(email);
        let created = false;
        let lastError: unknown;
        let finalUsername = usernameSeed;

        for (let attempt = 0; attempt < 4; attempt += 1) {
          const suffix = attempt === 0 ? "" : `_${Math.random().toString(36).slice(2, 6)}`;
          finalUsername = `${usernameSeed}${suffix}`;
          try {
            await authApi.register({
              username: finalUsername,
              email,
              password
            });
            created = true;
            break;
          } catch (error) {
            lastError = error;
            if (!(error instanceof ApiRequestError) || error.status !== 409) {
              break;
            }
          }
        }

        if (!created) {
          const message = lastError instanceof Error ? lastError.message : "Registration failed.";
          set({ status: "error", errorMessage: message });
          throw lastError instanceof Error ? lastError : new Error("Registration failed.");
        }

        try {
          const tokenResponse = await authApi.login({
            identifier: email,
            password
          });
          const token = tokenResponse.access_token;

          try {
            await usersApi.updateMe(token, {
              full_name: payload.fullName,
              title: payload.department ? `${payload.department} Member` : null
            });
          } catch {
            // Continue even if optional profile enrichment fails.
          }

          const apiUser = await usersApi.me(token);
          const user = mapApiUserToUser(apiUser);
          const session: AuthSession = {
            userId: String(apiUser.id),
            token
          };
          set({
            session,
            currentUser: user,
            status: "success",
            errorMessage: "",
            otpEmail: "",
            otpChallengeId: ""
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to complete sign in after registration.";
          set({
            status: "error",
            errorMessage: message
          });
          throw error;
        }
      },
      requestOtp: async (email) => {
        set({
          status: "loading",
          errorMessage: "",
          otpEmail: email.trim()
        });
        const error = unsupportedOtpError();
        set({
          status: "error",
          errorMessage: error.message
        });
        throw error;
      },
      verifyOtp: async () => {
        set({
          status: "loading",
          errorMessage: ""
        });
        const error = unsupportedOtpError();
        set({
          status: "error",
          errorMessage: error.message
        });
        throw error;
      },
      setCurrentUserFromApi: async (token) => {
        try {
          const apiUser = await usersApi.me(token);
          set({
            currentUser: mapApiUserToUser(apiUser)
          });
        } catch {
          return;
        }
      },
      logout: () => {
        const hasSeenOnboarding = get().hasSeenOnboarding;
        set({
          hasSeenOnboarding,
          session: null,
          currentUser: defaultUser,
          otpEmail: "",
          otpChallengeId: "",
          status: "idle",
          errorMessage: ""
        });
      }
    }),
    {
      name: "business-messenger-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
        session: state.session,
        currentUser: state.currentUser
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
