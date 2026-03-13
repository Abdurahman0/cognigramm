import { useColorScheme } from "react-native";

import { useSettingsStore } from "@/store/settingsStore";
import { getTheme } from "@/theme";

export const useAppTheme = () => {
  const systemScheme = useColorScheme();
  const preferredMode = useSettingsStore((state) => state.themeMode);
  const resolvedMode =
    preferredMode === "system" ? (systemScheme === "dark" ? "dark" : "light") : preferredMode;
  const theme = getTheme(resolvedMode);
  return {
    theme,
    isDark: resolvedMode === "dark",
    resolvedMode
  };
};
