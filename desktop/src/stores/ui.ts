import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

interface UiState {
  theme: ThemeMode
  /** Collapsing the conversation list gives the transcript the full window. */
  sidebarCollapsed: boolean
  detailsOpen: boolean
  setTheme: (theme: ThemeMode) => void
  toggleSidebar: () => void
  setDetailsOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      detailsOpen: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
    }),
    { name: 'qq.ui', storage: createJSONStorage(() => localStorage) },
  ),
)
