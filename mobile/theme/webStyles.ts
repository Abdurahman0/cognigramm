import { Platform } from "react-native";

import type { AppTheme } from "@/theme";

const STYLE_ELEMENT_ID = "qora-qarga-web-theme";

/**
 * Liquid Glass needs a real lens on web: backdrop blur plus saturation and a touch
 * of brightness so the material picks up the wallpaper's colour. Surfaces opt in with
 * `dataSet={{ glass: "regular" }}`, which react-native-web renders as `data-glass`.
 */
export const injectWebThemeStyles = (theme: AppTheme): void => {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }

  let styleTag = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleTag);
  }

  const { colors, blur, fontFamily } = theme;
  const lensBoost = theme.mode === "dark" ? "brightness(1.08)" : "brightness(1.04)";

  styleTag.textContent = `
    html, body, #root {
      height: 100%;
      background-color: ${colors.backdropBase};
    }
    body {
      margin: 0;
      font-family: ${fontFamily};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      overscroll-behavior: none;
    }
    ::selection {
      background: ${colors.accentMuted};
      color: ${colors.textPrimary};
    }
    [data-glass] {
      -webkit-backdrop-filter: blur(${blur.regular}px) saturate(180%) ${lensBoost};
      backdrop-filter: blur(${blur.regular}px) saturate(180%) ${lensBoost};
    }
    [data-glass="ultraThin"] {
      -webkit-backdrop-filter: blur(${blur.ultraThin}px) saturate(160%) ${lensBoost};
      backdrop-filter: blur(${blur.ultraThin}px) saturate(160%) ${lensBoost};
    }
    [data-glass="thin"] {
      -webkit-backdrop-filter: blur(${blur.thin}px) saturate(170%) ${lensBoost};
      backdrop-filter: blur(${blur.thin}px) saturate(170%) ${lensBoost};
    }
    [data-glass="thick"] {
      -webkit-backdrop-filter: blur(${blur.thick}px) saturate(190%) ${lensBoost};
      backdrop-filter: blur(${blur.thick}px) saturate(190%) ${lensBoost};
    }
    [data-glass="none"] {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    [data-bloom] {
      filter: blur(110px);
    }
    * {
      scrollbar-width: thin;
      scrollbar-color: ${colors.textMuted} transparent;
    }
    *::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    *::-webkit-scrollbar-track {
      background: transparent;
    }
    *::-webkit-scrollbar-thumb {
      background: ${colors.textMuted};
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: padding-box;
      min-height: 28px;
    }
    *::-webkit-scrollbar-thumb:hover {
      background: ${colors.textSecondary};
      border: 2px solid transparent;
      background-clip: padding-box;
    }
  `;
};
