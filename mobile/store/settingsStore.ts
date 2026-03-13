import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AppSettingsState, ThemeMode } from "@/types";

interface SettingsStore extends AppSettingsState {
  hydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setCompactMode: (enabled: boolean) => void;
  updateNotification: <K extends keyof AppSettingsState["notifications"]>(
    key: K,
    value: AppSettingsState["notifications"][K]
  ) => void;
  markHydrated: () => void;
}

const initialSettings: AppSettingsState = {
  themeMode: "system",
  compactMode: false,
  notifications: {
    pushEnabled: true,
    emailDigest: false,
    mentionsOnly: false,
    urgentOnly: false,
    callAlerts: true,
    announcementAlerts: true
  }
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      hydrated: false,
      ...initialSettings,
      setThemeMode: (mode) => set({ themeMode: mode }),
      setCompactMode: (enabled) => set({ compactMode: enabled }),
      updateNotification: (key, value) =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: value
          }
        })),
      markHydrated: () => set({ hydrated: true })
    }),
    {
      name: "business-messenger-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        compactMode: state.compactMode,
        notifications: state.notifications
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
