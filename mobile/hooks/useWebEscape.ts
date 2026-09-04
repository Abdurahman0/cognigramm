import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Dismiss a sheet or detail screen with Escape on web, the way a native dialog behaves.
 * No-op on touch platforms, where the gesture and the close button already cover it.
 */
export const useWebEscape = (onEscape: () => void, enabled = true): void => {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !enabled) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [enabled, onEscape]);
};
