import { Platform } from "react-native";

import type { AppTheme } from "@/theme";

const STYLE_ELEMENT_ID = "qora-qarga-web-theme";

/**
 * Web half of the Liquid Glass material.
 *
 * Surfaces opt in with `dataSet={{ glass, lens, interactive }}`, which react-native-web
 * renders as `data-*` attributes:
 *
 * - `[data-glass]`       blurs and saturates whatever sits behind the surface
 * - `[data-lens]`        adds the specular sheen (lit from the pointer), grain, and a
 *                        refracting edge band that re-blurs the backdrop at the rim
 * - `[data-droplet]`    the selection lens: a bead of clear liquid, drawn with edge
 *                        light and a caustic rather than a tint
 * - `[data-interactive]` eases transform/shadow changes so hover and press feel physical
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
  // Water magnifies what is behind it, so the bead reads a shade brighter than the bar.
  const dropletGain = theme.mode === "dark" ? "1.35" : "1.05";
  const dropletEdgeGain = theme.mode === "dark" ? "1.5" : "1.08";
  const grain =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.10'/%3E%3C/svg%3E\")";

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

    /* Specular sheen: a viewport-fixed light source at the pointer, a directional
       sweep, and fine grain so large panes never read as flat plastic. */
    [data-lens]::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 1;
      background-image:
        linear-gradient(135deg, ${colors.sheenSoft} 0%, transparent 42%, ${colors.sheenEdge} 100%),
        ${grain};
      background-size: auto, 140px 140px;
      background-blend-mode: normal, soft-light;
      opacity: 0.55;
    }

    /* Refracting edge: the rim re-blurs the backdrop and carries the bevel, which is
       what makes a surface read as a thick lens instead of a flat film. */
    [data-lens]::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 2;
      padding: 5px;
      box-sizing: border-box;
      -webkit-backdrop-filter: blur(6px) saturate(220%) brightness(1.12);
      backdrop-filter: blur(6px) saturate(220%) brightness(1.12);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      box-shadow:
        inset 0 1px 0 ${colors.specularTop},
        inset 0 0 0 0.5px ${colors.glassBorder},
        inset 0 -1px 2px ${colors.specularBottom};
    }

    /* A bead of clear water sitting on the glass.
       Almost no tint — the shape is drawn entirely with light: a bright meniscus where
       the surface curves away at the top, a caustic along the bottom where light bends
       through and focuses, a shaded band under the top edge to give the bead thickness,
       and a soft contact shadow. */
    [data-droplet] {
      background-image: linear-gradient(
        to bottom,
        ${colors.dropletCrown} 0%,
        ${colors.dropletBody} 34%,
        transparent 56%,
        ${colors.dropletPool} 100%
      );
      -webkit-backdrop-filter: blur(0.5px) saturate(210%) brightness(${dropletGain});
      backdrop-filter: blur(0.5px) saturate(210%) brightness(${dropletGain});
      box-shadow:
        /* the two edges that actually catch light: a crisp meniscus on top, and the
           base where the bead meets the surface */
        inset 0 1px 0.5px -0.25px ${colors.dropletMeniscus},
        inset 0 -1.5px 1px -0.75px ${colors.dropletCaustic},
        /* a thin shade under the crown gives the bead thickness, and light pools just
           above the base as it leaves */
        inset 0 5px 9px -8px ${colors.dropletDepth},
        inset 0 -8px 11px -9px ${colors.dropletCaustic},
        0 0 0 0.5px ${colors.dropletRim},
        0 1px 2px -1px ${colors.dropletShadow},
        0 3px 9px -3px ${colors.dropletShadow};
    }

    /* Specular glint where the light source reflects off the crown, and the caustic
       where that focused light leaves the far side. */
    [data-droplet]::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 1;
      background-image:
        radial-gradient(34% 56% at 27% 23%, ${colors.dropletGlint}, transparent 72%),
        radial-gradient(44% 74% at 76% 88%, ${colors.dropletCaustic}, transparent 68%);
    }

    /* Refraction: the rim re-blurs and brightens what is behind it, which is what
       separates a bead of liquid from a highlight painted on a flat pill. */
    [data-droplet]::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 2;
      padding: 3px;
      box-sizing: border-box;
      -webkit-backdrop-filter: blur(4px) saturate(260%) brightness(${dropletEdgeGain});
      backdrop-filter: blur(4px) saturate(260%) brightness(${dropletEdgeGain});
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }

    /* Raised list cards.
       A row reads as a solid object rather than a tinted stripe when it is lit from
       above: a bright bevel along the top edge, a gradient that falls off down the
       face, a shaded underside, and two shadows — a tight contact shadow plus a wider
       soft one for the gap it floats above. Hovering lifts the card and lengthens the
       shadow; pressing sinks it and turns the bevel inside out. */
    [data-raised] {
      background-image: linear-gradient(
        to bottom,
        ${colors.raisedTop} 0%,
        transparent 46%,
        ${colors.raisedBottom} 100%
      );
      box-shadow:
        inset 0 1px 0 ${colors.raisedEdge},
        inset 0 -1px 0 ${colors.raisedUnder},
        0 1px 1.5px -0.5px ${colors.raisedShadowNear},
        0 6px 16px -6px ${colors.raisedShadowFar};
      transition:
        box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1),
        background-color 160ms ease-out;
    }

    [data-raised="hovered"] {
      box-shadow:
        inset 0 1px 0 ${colors.raisedEdge},
        inset 0 -1px 0 ${colors.raisedUnder},
        0 2px 3px -1px ${colors.raisedShadowNear},
        0 12px 26px -8px ${colors.raisedShadowFar};
    }

    /* Pressed: the light moves to the underside, which is what a real button does when
       it goes below the surface. */
    [data-raised="pressed"] {
      box-shadow:
        inset 0 2px 6px -2px ${colors.raisedUnder},
        inset 0 -1px 0 ${colors.raisedEdge},
        0 1px 1px -0.5px ${colors.raisedShadowNear};
    }

    /* Physical response: eased transform and shadow so hover, press and drag settle. */
    [data-interactive] {
      transition:
        transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
        background-color 160ms ease-out;
      will-change: transform;
    }

    /* Cards you can flick away say so under the cursor. */
    [data-grab] {
      cursor: grab;
      touch-action: none;
    }

    [data-grab]:active {
      cursor: grabbing;
    }

    [data-bloom] {
      filter: blur(64px);
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

    @media (prefers-reduced-motion: reduce) {
      [data-interactive] {
        transition: none;
      }
    }
  `;
};
