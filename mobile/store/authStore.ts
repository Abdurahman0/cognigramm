import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { mapApiUserToUser } from "@/services/api/adapters";
import { authApi, usersApi } from "@/services/api";
import { ApiRequestError } from "@/services/api/httpClient";
import {
  adoptTokens,
  clearSession,
  ensureAccessToken,
  hasStoredSession,
  setSessionLostHandler,
  setTokenListener
} from "@/services/api/session";
import type { AsyncStatus, AuthSession, LoginPayload, RegisterPayload, User } from "@/types";

interface AuthState {
  hydrated: boolean;
  hasSeenOnboarding: boolean;
  session: AuthSession | null;
  currentUser: User;
  status: AsyncStatus;
  errorMessage: string;
  /** Set when a session ended for a reason worth showing on the sign-in screen. */
  endedReason: string;
  markHydrated: () => void;
  completeOnboarding: () => void;
  /** Startup: exchange the stored refresh token, then load the profile. */
  restoreSession: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      hasSeenOnboarding: false,
      session: null,
      currentUser: defaultUser,
      status: "idle",
      errorMessage: "",
      endedReason: "",
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
          // The access token has to be live before /users/me is called, and the
          // rotated refresh token is persisted by `adoptTokens` first.
          const token = await adoptTokens(tokenResponse);
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
            endedReason: ""
          });
        } catch (error) {
          await clearSession();
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
          const token = await adoptTokens(tokenResponse);

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
            endedReason: ""
          });
        } catch (error) {
          await clearSession();
          const message = error instanceof Error ? error.message : "Unable to complete sign in after registration.";
          set({
            status: "error",
            errorMessage: message
          });
          throw error;
        }
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
      restoreSession: async () => {
        if (get().session) {
          return;
        }
        if (!(await hasStoredSession())) {
          set({ status: "idle" });
          return;
        }

        // The stored refresh token is the only durable credential: an access
        // token lives 15 minutes and never survives a restart.
        const token = await ensureAccessToken();
        if (!token) {
          return;
        }

        try {
          const apiUser = await usersApi.me(token);
          set({
            session: { userId: String(apiUser.id), token },
            currentUser: mapApiUserToUser(apiUser),
            status: "success",
            errorMessage: "",
            endedReason: ""
          });
        } catch {
          // A profile that will not load is not a reason to discard a session
          // the server still accepts; the next request retries.
        }
      },
      logout: () => {
        const hasSeenOnboarding = get().hasSeenOnboarding;
        // Tell the server first: that revokes this device session and closes
        // the socket it holds. Failing here is not worth blocking the sign-out.
        void authApi.logout().catch(() => undefined);
        void clearSession();
        set({
          hasSeenOnboarding,
          session: null,
          currentUser: defaultUser,
          status: "idle",
          errorMessage: ""
        });
      }
    }),
    {
      name: "business-messenger-auth",
      storage: createJSONStorage(() => AsyncStorage),
      // The access token is deliberately not persisted: it expires in 15
      // minutes, and the durable credential is the refresh token, which lives
      // in the Keychain / Keystore instead.
      partialize: (state) => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
        currentUser: state.currentUser
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);

/**
 * A rotated access token has to reach `session.token`, which the rest of the
 * app reads when it calls the API or opens the socket.
 */
setTokenListener((token) => {
  const session = useAuthStore.getState().session;
  if (session && session.token !== token) {
    useAuthStore.setState({ session: { ...session, token } });
  }
});

/**
 * A dead session anywhere — a rejected refresh, a revoked device, a socket
 * closed with 4001 — lands here and returns the app to the sign-in screen.
 */
setSessionLostHandler((reason) => {
  const state = useAuthStore.getState();
  if (!state.session) {
    return;
  }
  useAuthStore.setState({
    session: null,
    currentUser: defaultUser,
    status: "idle",
    errorMessage: "",
    endedReason: reason
  });
});
