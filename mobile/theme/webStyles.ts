import { Platform } from "react-native";

import type { AppTheme } from "@/theme";

const STYLE_ELEMENT_ID = "qora-qarga-web-theme";

/**
 * Real backdrop blur is only available through CSS, so web glass surfaces opt in with
 * `dataSet={{ glass: "panel" }}` (rendered as `data-glass="panel"` by react-native-web)
 * and pick up the filters injected here.
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

  const { colors, blur } = theme;

  styleTag.textContent = `
    html, body, #root {
      height: 100%;
      background-color: ${colors.backdropBase};
    }
    body {
      margin: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overscroll-behavior: none;
    }
    ::selection {
      background: ${colors.accentMuted};
      color: ${colors.textPrimary};
    }
    [data-glass] {
      -webkit-backdrop-filter: blur(${blur.panel}px) saturate(150%);
      backdrop-filter: blur(${blur.panel}px) saturate(150%);
    }
    [data-glass="soft"] {
      -webkit-backdrop-filter: blur(${blur.soft}px) saturate(130%);
      backdrop-filter: blur(${blur.soft}px) saturate(130%);
    }
    [data-glass="strong"] {
      -webkit-backdrop-filter: blur(${blur.strong}px) saturate(165%);
      backdrop-filter: blur(${blur.strong}px) saturate(165%);
    }
    [data-glass="none"] {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    [data-bloom] {
      filter: blur(90px);
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
