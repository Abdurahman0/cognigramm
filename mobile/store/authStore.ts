import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CURRENT_USER_ID, mockUsers } from "@/mock";
import { mockLogin, mockRegister, mockRequestOtp, mockVerifyOtp } from "@/services/mockApi";
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
  logout: () => void;
}

const currentUser = mockUsers.find((user) => user.id === CURRENT_USER_ID) ?? mockUsers[0];

const defaultUser: User =
  currentUser ??
  ({
    id: "u_default",
    fullName: "Team Member",
    email: "member@company.local",
    avatar: "",
    role: "intern",
    department: "Engineering",
    title: "Team Member",
    presence: "available",
    isOnline: true,
    about: "",
    timezone: "Asia/Tashkent"
  } satisfies User);

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
          const session = await mockLogin(payload);
          const user = mockUsers.find((candidate) => candidate.id === session.userId) ?? defaultUser;
          set({ session, currentUser: user, status: "success" });
        } catch (error) {
          set({ status: "error", errorMessage: error instanceof Error ? error.message : "Login failed." });
          throw error;
        }
      },
      register: async (payload) => {
        set({ status: "loading", errorMessage: "" });
        try {
          const user = await mockRegister(payload);
          const session: AuthSession = { userId: user.id, token: `token_${Date.now()}` };
          set({ session, currentUser: user, status: "success" });
        } catch (error) {
          set({ status: "error", errorMessage: error instanceof Error ? error.message : "Registration failed." });
          throw error;
        }
      },
      requestOtp: async (email) => {
        set({ status: "loading", errorMessage: "", otpEmail: email });
        try {
          const response = await mockRequestOtp(email);
          set({ otpChallengeId: response.challengeId, status: "success" });
        } catch (error) {
          set({
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Verification request failed."
          });
          throw error;
        }
      },
      verifyOtp: async (code) => {
        const email = get().otpEmail;
        set({ status: "loading", errorMessage: "" });
        try {
          const session = await mockVerifyOtp({ email, code });
          const user = mockUsers.find((candidate) => candidate.id === session.userId) ?? defaultUser;
          set({ session, currentUser: user, status: "success" });
        } catch (error) {
          set({ status: "error", errorMessage: error instanceof Error ? error.message : "OTP check failed." });
          throw error;
        }
      },
      logout: () => {
        set({ session: null, status: "idle", errorMessage: "", otpEmail: "", otpChallengeId: "" });
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
