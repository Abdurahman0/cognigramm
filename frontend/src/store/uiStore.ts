"use client";

import { create } from "zustand";

type ThemeMode = "light" | "dark";

interface UIState {
  mobileSidebarOpen: boolean;
  theme: ThemeMode;
  setMobileSidebarOpen: (isOpen: boolean) => void;
  toggleTheme: () => void;
  hydrateTheme: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  mobileSidebarOpen: false,
  theme: "light",
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    if (typeof window !== "undefined") {
      localStorage.setItem("messenger_theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    set({ theme: next });
  },
  hydrateTheme: () => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = localStorage.getItem("messenger_theme");
    const next: ThemeMode = stored === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", next === "dark");
    set({ theme: next });
  }
}));
