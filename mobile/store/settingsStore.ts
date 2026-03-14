import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AppSettingsState, ThemeMode } from "@/types";

interface SettingsStore extends AppSettingsState {
  hydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setCompactMode: (enabled: boolean) => void;
  markHydrated: () => void;
}

const initialSettings: AppSettingsState = {
  themeMode: "system",
  compactMode: false
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      hydrated: false,
      ...initialSettings,
      setThemeMode: (mode) => set({ themeMode: mode }),
      setCompactMode: (enabled) => set({ compactMode: enabled }),
      markHydrated: () => set({ hydrated: true })
    }),
    {
      name: "business-messenger-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        compactMode: state.compactMode
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      }
    }
  )
);
