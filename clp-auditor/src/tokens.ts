/**
 * Hinge Health MWEB Design System Token Reference
 * Source: @hinge-health/consumer-web-lib + src/styles/themeConstants.ts
 *
 * Used by the auditor to validate that code uses approved tokens.
 */

// ─── COLORS ──────────────────────────────────────────────

export const APPROVED_COLORS: Record<string, string[]> = {
  GRAYSCALE: [
    "#000000", "#1C1B1F", "#373938", "#484649", "#676767",
    "#848484", "#A0A0A0", "#BCBCBC", "#D6D6D6", "#DDDDDD",
    "#EDEDED", "#F9F9F9", "#FFFFFF",
  ],
  EVERGREEN: [
    "#000000", "#003617", "#00491F", "#006730", "#007B34",
    "#00842D", "#00A749", "#0EBB65", "#2DD081", "#BDE9C9",
    "#D9F2E4", "#EAFAF1", "#FFFFFF",
  ],
  OAT: ["#FFFBED"],
  YELLOW: ["#FFC600", "#FFD74A", "#FFE790", "#FFEEB2", "#FFF5D0"],
  RED: ["#EE3932", "#FE5A54", "#FF9490", "#FAC3C1", "#FFDAD9"],
  FUCHSIA: ["#E55CCD", "#F87FE2", "#FDBEF2", "#FBD5F2", "#FFE8F9"],
  SAND: ["#CFB991", "#E2D2B8", "#EAE0D0", "#F1EADE"],
  ERRORRED: ["#EE0004"],
};

export const EXTRA_COLORS: Record<string, string> = {
  CLEAR: "rgba(255,255,255,0)",
  AD_LINK: "#00BD4F",
  ARTICLE_NAV_BACKGROUND: "#EAFAF1",
  ARTICLE_NAV_BAR_BACKGROUND: "#232E2E",
  ARTICLE_NAV_BAR_PROGRESS: "#22D081",
  ACCORDION_BACKGROUND: "#EAFAF1",
  EXERCISE_PLAYLIST_ICON_BACKGROUND: "#336F69",
  EXERCISE_PLAYLIST_HEADER_BACKGROUND: "#1A2222",
  EXERCISE_PLAYLIST_HEADER_LINK: "#22D081",
  EMPLOYER_SEARCH_BANNER_COLOR: "#BFE9D1",
  STICKER_COPY_COLOR: "#2A2A2A",
  BASIC_HERO_STICKER_FILL_COLOR: "#FFD7CF",
  CALLOUT_QUOTE_BORDER: "#FFC600",
  INCENTIVE_BANNER_BACKGROUND_COLOR: "#BFE9D1",
  SIMPLE_BANNER_BACKGROUND_COLOR: "#C9EEAC",
  SIMPLE_BANNER_HOVER_COLOR: "#E1F7C9",
  OFF_WHITE_BACKGROUND: "#F9F8F6",
  LIGHT_GRAY_BACKGROUND: "#E8E6E1",
  AD_MODAL_BACKGROUND: "#FFEEB2",
  SELECTOR_TEXT_BORDER: "#E5E5E5",
  SELECTOR_TEXT_BORDER_SELECTED: "#4C8C43",
  GREENFOREST20: "#00491F",
  OAT90: "#FFFBED",
  TWITTER_ICON_COLOR: "#1DA1F2",
};

// Legacy colors — should NOT be used
export const LEGACY_COLOR_NAMES = [
  "HOPE_DIAMOND", "SEA_FOAM", "LIME", "AUBERGINE",
  "RASPBERRY", "PEACH", "HH_ORANGE",
];

// Build a flat set of all approved hex values (uppercase)
export const ALL_APPROVED_HEX = new Set<string>();
for (const palette of Object.values(APPROVED_COLORS)) {
  for (const hex of palette) {
    ALL_APPROVED_HEX.add(hex.toUpperCase());
  }
}
for (const hex of Object.values(EXTRA_COLORS)) {
  if (hex.startsWith("#")) {
    ALL_APPROVED_HEX.add(hex.toUpperCase());
  }
}

// ─── TYPOGRAPHY ──────────────────────────────────────────

export const FONT_FAMILY = "BrownLLWeb";
export const FONT_FALLBACK = "sans-serif";

export const FONT_SIZES = new Set([
  12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 34, 36, 40, 48, 56,
]);

export const FONT_WEIGHTS = new Set([300, 400, 500, 600, 700, 900]);

export const LINE_HEIGHTS = new Set([
  "100%", "110%", "120%", "130%", "140%", "150%",
]);

// ─── SPACING ─────────────────────────────────────────────

export const SPACE = [0, 4, 8, 16, 24, 32, 40, 64, 128, 256, 512];
export const SPACE_SET = new Set(SPACE);

// ─── BORDER RADIUS ───────────────────────────────────────

export const RADII: Record<string, number> = {
  xsmall: 4,
  small: 8,
  default: 12,
  medium: 16,
  large: 18,
};
export const RADII_VALUES = new Set(Object.values(RADII));

// ─── BREAKPOINTS ─────────────────────────────────────────

export const STANDARD_BREAKPOINTS = new Set([768, 992, 1440]);

// Known custom breakpoints (documented exceptions)
export const KNOWN_CUSTOM_BREAKPOINTS: Record<number, string> = {
  450: "BasicHero mobile",
  451: "BasicHero tablet-and-above",
  1100: "Main nav legacy (MWEB-1166)",
  1101: "Main nav desktop legacy",
  965: "ThreeColumnCard",
};

// ─── Z-INDEX ─────────────────────────────────────────────

export const Z_INDICES = new Set([
  -5, -3, 1, 2, 9, 10, 475, 480, 490, 500, 600, 1000, 10000, 100000, 2147483647,
]);

// ─── HELPERS ─────────────────────────────────────────────

/** Normalize a hex color to uppercase 6-digit form */
export function normalizeHex(hex: string): string {
  let h = hex.trim().toUpperCase();
  // Expand 3-digit hex: #ABC → #AABBCC
  if (/^#[0-9A-F]{3}$/i.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

/** Find the nearest approved token for a given hex color */
export function findNearestToken(hex: string): string | undefined {
  const normalized = normalizeHex(hex);
  if (ALL_APPROVED_HEX.has(normalized)) return normalized;

  // Check EXTRA_COLORS by name
  for (const [name, value] of Object.entries(EXTRA_COLORS)) {
    if (value.toUpperCase() === normalized) return `EXTRA_COLORS.${name}`;
  }

  // Check each palette
  for (const [palette, colors] of Object.entries(APPROVED_COLORS)) {
    for (let i = 0; i < colors.length; i++) {
      if (colors[i].toUpperCase() === normalized) {
        return `COLORS.${palette}[${i * 10}]`;
      }
    }
  }

  return undefined;
}

/** Check if a px value is in the SPACE scale */
export function isValidSpacing(px: number): boolean {
  return SPACE_SET.has(px);
}

/** Check if a px value is a valid font size */
export function isValidFontSize(px: number): boolean {
  return FONT_SIZES.has(px);
}

/** Check if a value is a valid font weight */
export function isValidFontWeight(weight: number): boolean {
  return FONT_WEIGHTS.has(weight);
}

/** Check if a px value is a valid border radius */
export function isValidRadius(px: number): boolean {
  return RADII_VALUES.has(px);
}

/** Find the nearest SPACE token for a px value */
export function findNearestSpace(px: number): number {
  let nearest = SPACE[0];
  let minDiff = Math.abs(px - nearest);
  for (const s of SPACE) {
    const diff = Math.abs(px - s);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = s;
    }
  }
  return nearest;
}

/** Find the nearest font size token */
export function findNearestFontSize(px: number): number {
  const sizes = [...FONT_SIZES];
  let nearest = sizes[0];
  let minDiff = Math.abs(px - nearest);
  for (const s of sizes) {
    const diff = Math.abs(px - s);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = s;
    }
  }
  return nearest;
}
