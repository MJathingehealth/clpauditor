/**
 * Token Scanner — Static analysis of source files for design system violations.
 *
 * Scans .tsx/.ts/.css files for hardcoded values that should use design tokens:
 * - Colors (hex, rgb, rgba)
 * - Font sizes, weights, families
 * - Spacing (padding, margin, gap)
 * - Border radius
 * - Breakpoints
 * - Z-indices
 */

import { readFileSync } from "fs";
import { basename } from "path";
import {
  ALL_APPROVED_HEX,
  FONT_SIZES,
  FONT_WEIGHTS,
  SPACE_SET,
  RADII_VALUES,
  STANDARD_BREAKPOINTS,
  KNOWN_CUSTOM_BREAKPOINTS,
  Z_INDICES,
  normalizeHex,
  findNearestToken,
  findNearestSpace,
  findNearestFontSize,
} from "./tokens.js";
import type { AuditFinding, Severity } from "./types.js";

// ─── PATTERNS ────────────────────────────────────────────

// Match hex colors: #RGB, #RRGGBB, #RRGGBBAA
const HEX_PATTERN = /#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?\b/g;

// Match rgb/rgba: rgb(R, G, B) or rgba(R, G, B, A)
const RGBA_PATTERN = /rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*[\d.]+)?\s*\)/g;

// Match font-size with px value
const FONT_SIZE_PATTERN = /font-size\s*:\s*(\d+(?:\.\d+)?)px/gi;

// Match font-weight with numeric value or keyword
const FONT_WEIGHT_PATTERN = /font-weight\s*:\s*(\d+|bold|normal|lighter|bolder)/gi;

// Match font-family declarations
const FONT_FAMILY_PATTERN = /font-family\s*:\s*([^;}\n]+)/gi;

// Match padding/margin/gap with px values
const SPACING_PATTERN = /(?:padding|margin|gap)(?:-(?:top|right|bottom|left))?\s*:\s*([^;}\n]+)/gi;

// Match border-radius with px values
const BORDER_RADIUS_PATTERN = /border-radius\s*:\s*([^;}\n]+)/gi;

// Match media queries with px breakpoints
const BREAKPOINT_PATTERN = /(?:min-width|max-width)\s*:\s*(\d+)px/gi;

// Match z-index values
const Z_INDEX_PATTERN = /z-index\s*:\s*(-?\d+)/gi;

// ─── SKIP PATTERNS ───────────────────────────────────────

// Files/paths to skip (test files, mocks, stories, node_modules)
const SKIP_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\.stories\./,
  /__mocks__/,
  /node_modules/,
  /\.jest/,
  /coverage/,
  /dist/,
  /\.storybook/,
];

// Lines to skip (comments, imports, console.log)
const SKIP_LINE_PATTERNS = [
  /^\s*\/\//,          // single-line comment
  /^\s*\*/,            // multi-line comment body
  /^\s*import\s/,      // import statements
  /console\./,         // console statements
  /\/\/.*#[0-9a-f]/i,  // hex in comments
];

// Known safe hex values (transparent, currentColor, etc.)
const SAFE_VALUES = new Set([
  "transparent", "inherit", "currentColor", "none", "initial", "unset",
]);

// Patterns indicating a value is using tokens/variables (should skip)
const TOKEN_REFERENCE_PATTERNS = [
  /theme\./,           // theme.colors.*, theme.palette.*
  /COLORS\./,          // COLORS.GRAYSCALE, etc.
  /EXTRA_COLORS\./,    // EXTRA_COLORS.*
  /SPACE\[/,           // SPACE[4], SPACE[8], etc.
  /RADII\./,           // RADII.small, etc.
  /FONT_SIZES\./,      // FONT_SIZES.*
  /FONT_WEIGHTS\./,    // FONT_WEIGHTS.*
  /var\(/,             // CSS variables: var(--color-primary)
  /calc\(/,            // CSS calc: calc(100% - 20px)
  /\$\{/,              // Template literals: ${someVar}
];

// ─── SCANNER ─────────────────────────────────────────────

export function shouldSkipFile(filePath: string): boolean {
  return SKIP_PATTERNS.some(p => p.test(filePath));
}

function shouldSkipLine(line: string): boolean {
  return SKIP_LINE_PATTERNS.some(p => p.test(line));
}

function extractPxValues(cssValue: string): number[] {
  const matches = cssValue.match(/(\d+(?:\.\d+)?)px/g) || [];
  return matches.map(m => parseFloat(m));
}

export function scanFile(filePath: string): AuditFinding[] {
  if (shouldSkipFile(filePath)) return [];

  const fileName = basename(filePath);
  // Skip non-source files
  if (!/\.(tsx?|css)$/.test(fileName)) return [];

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const lines = content.split("\n");
  const findings: AuditFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (shouldSkipLine(line)) continue;

    // ── Color checks ──
    scanColors(line, lineNum, filePath, findings);

    // ── Font size checks ──
    scanFontSizes(line, lineNum, filePath, findings);

    // ── Font weight checks ──
    scanFontWeights(line, lineNum, filePath, findings);

    // ── Font family checks ──
    scanFontFamily(line, lineNum, filePath, findings);

    // ── Spacing checks ──
    scanSpacing(line, lineNum, filePath, findings);

    // ── Border radius checks ──
    scanBorderRadius(line, lineNum, filePath, findings);

    // ── Breakpoint checks ──
    scanBreakpoints(line, lineNum, filePath, findings);

    // ── Z-index checks ──
    scanZIndex(line, lineNum, filePath, findings);
  }

  return findings;
}

// ─── COLOR SCANNER ───────────────────────────────────────

function scanColors(
  line: string,
  lineNum: number,
  filePath: string,
  findings: AuditFinding[],
): void {
  // Check hex colors
  let match: RegExpExecArray | null;
  HEX_PATTERN.lastIndex = 0;
  while ((match = HEX_PATTERN.exec(line)) !== null) {
    const hex = match[0];
    const normalized = normalizeHex(hex);

    // Skip if it's in a variable assignment that IS a token definition
    if (/(?:COLORS|EXTRA_COLORS|LEGACY_COLORS)\s*[.[]/.test(line)) continue;
    // Skip if referencing theme
    if (/theme\.(colors|palette)/.test(line)) continue;
    // Skip if in a comment within the line
    if (line.indexOf("//") !== -1 && line.indexOf("//") < (match.index ?? 0)) continue;

    if (!ALL_APPROVED_HEX.has(normalized)) {
      const nearest = findNearestToken(hex);
      findings.push({
        severity: "P2",
        category: "color",
        pillar: "design-fidelity",
        check: "B1: Colors use tokens",
        message: `Hardcoded color ${hex} is not in the approved token set`,
        file: filePath,
        line: lineNum,
        actual: hex,
        expected: nearest ?? "Use COLORS.* or EXTRA_COLORS.*",
      });
    }
  }

  // Check rgba values (just flag them — harder to auto-match)
  RGBA_PATTERN.lastIndex = 0;
  while ((match = RGBA_PATTERN.exec(line)) !== null) {
    const rgba = match[0];
    // Skip known safe rgba values
    if (/POPUP_OVERLAY_MASK|AD_OVERLAY_MASK|VIDEO_OVERLAY_MASK/.test(line)) continue;
    if (/EXTRA_COLORS/.test(line)) continue;

    // Only flag if it looks like an inline style, not a token reference
    if (!line.includes("COLORS") && !line.includes("theme")) {
      findings.push({
        severity: "P3",
        category: "color",
        pillar: "design-fidelity",
        check: "B7: Opacity/overlay values",
        message: `Inline rgba value — verify it matches a design token`,
        file: filePath,
        line: lineNum,
        actual: rgba,
        expected: "Use EXTRA_COLORS.* or a named overlay token",
      });
    }
  }
}

// ─── FONT SIZE SCANNER ───────────────────────────────────

function scanFontSizes(
  line: string,
  lineNum: number,
  filePath: string,
  findings: AuditFinding[],
): void {
  FONT_SIZE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FONT_SIZE_PATTERN.exec(line)) !== null) {
    const size = parseFloat(match[1]);
    // Skip if referencing FONT_SIZES constant
    if (/FONT_SIZES/.test(line)) continue;

    if (!FONT_SIZES.has(size)) {
      const nearest = findNearestFontSize(size);
      findings.push({
        severity: "P2",
        category: "typography",
        pillar: "design-fidelity",
        check: "A2: Font size matches token",
        message: `Font size ${size}px is not in the type scale`,
        file: filePath,
        line: lineNum,
        actual: `${size}px`,
        expected: `${nearest}px (nearest token)`,
      });
    }
  }
}

// ─── FONT WEIGHT SCANNER ─────────────────────────────────

function scanFontWeights(
  line: string,
  lineNum: number,
  filePath: string,
  findings: AuditFinding[],
): void {
  FONT_WEIGHT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FONT_WEIGHT_PATTERN.exec(line)) !== null) {
    const raw = match[1];
    if (/FONT_WEIGHTS/.test(line)) continue;

    // Check keyword weights
    const KEYWORD_MAP: Record<string, number> = {
      normal: 400,
      bold: 700,
      lighter: 300,
      bolder: 700,
    };

    if (KEYWORD_MAP[raw.toLowerCase()]) {
      findings.push({
        severity: "P3",
        category: "typography",
        pillar: "design-fidelity",
        check: "A3: Font weight matches token",
        message: `Font weight keyword "${raw}" — use numeric token instead`,
        file: filePath,
        line: lineNum,
        actual: raw,
        expected: `${KEYWORD_MAP[raw.toLowerCase()]} (FONT_WEIGHTS)`,
      });
    } else {
      const weight = parseInt(raw, 10);
      if (!isNaN(weight) && !FONT_WEIGHTS.has(weight)) {
        findings.push({
          severity: "P2",
          category: "typography",
          pillar: "design-fidelity",
          check: "A3: Font weight matches token",
          message: `Font weight ${weight} is not in the approved set`,
          file: filePath,
          line: lineNum,
          actual: `${weight}`,
          expected: "300, 400, 500, 600, 700, or 900",
        });
      }
    }
  }
}

// ─── FONT FAMILY SCANNER ─────────────────────────────────

function scanFontFamily(
  line: string,
  lineNum: number,
  filePath: string,
  findings: AuditFinding[],
): void {
  FONT_FAMILY_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FONT_FAMILY_PATTERN.exec(line)) !== null) {
    const family = match[1].trim();
    if (/BrownLLWeb|sans-serif|inherit|FONT_FAMILY/.test(family)) continue;

    findings.push({
      severity: "P1",
      category: "typography",
      pillar: "design-fidelity",
      check: "A1: Font family",
      message: `Non-standard font family: "${family}"`,
      file: filePath,
      line: lineNum,
      actual: family,
      expected: "BrownLLWeb, sans-serif",
    });
  }
}

// ─── SPACING SCANNER ─────────────────────────────────────

function scanSpacing(
  line: string,
  lineNum: number,
  filePath: string,
  findings: AuditFinding[],
): void {
  SPACING_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPACING_PATTERN.exec(line)) !== null) {
    const value = match[1];
    // Skip if using theme/SPACE tokens, calc(), or variables
    if (/SPACE|theme|var\(|calc\(|auto|inherit|%/.test(value)) continue;
    // Skip shorthand with 0 only
    if (/^0(px)?$/.test(value.trim())) continue;

    const pxValues = extractPxValues(value);
    for (const px of pxValues) {
      if (px === 0) continue;
      if (!SPACE_SET.has(px)) {
        const nearest = findNearestSpace(px);
        findings.push({
          severity: "P2",
          category: "spacing",
          pillar: "design-fidelity",
          check: "C1: Spacing uses SPACE tokens",
          message: `Spacing value ${px}px is not in the SPACE scale`,
          file: filePath,
          line: lineNum,
          actual: `${px}px`,
          expected: `${nearest}px (SPACE[${SPACE_SET.size}] nearest)`,
        });
      }
    }
  }
}

// ─── BORDER RADIUS SCANNER ───────────────────────────────

function scanBorderRadius(
  line: string,
  lineNum: number,
  filePath: string,
  findings: AuditFinding[],
): void {
  BORDER_RADIUS_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BORDER_RADIUS_PATTERN.exec(line)) !== null) {
    const value = match[1];
    if (/RADII|theme|var\(|50%|inherit/.test(value)) continue;

    const pxValues = extractPxValues(value);
    for (const px of pxValues) {
      if (px === 0) continue;
      if (!RADII_VALUES.has(px)) {
        findings.push({
          severity: "P2",
          category: "component",
          pillar: "design-fidelity",
          check: "D3: Border radius uses RADII",
          message: `Border radius ${px}px is not in RADII tokens (4, 8, 12, 16, 18)`,
          file: filePath,
          line: lineNum,
          actual: `${px}px`,
          expected: "4, 8, 12, 16, or 18px",
        });
      }
    }
  }
}

// ─── BREAKPOINT SCANNER ──────────────────────────────────

function scanBreakpoints(
  line: string,
  lineNum: number,
  filePath: string,
  findings: AuditFinding[],
): void {
  BREAKPOINT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BREAKPOINT_PATTERN.exec(line)) !== null) {
    const bp = parseInt(match[1], 10);
    if (/BREAKPOINTS|MAIN_NAV_BREAKPOINTS|BASIC_HERO_BREAKPOINTS/.test(line)) continue;

    if (!STANDARD_BREAKPOINTS.has(bp)) {
      const known = KNOWN_CUSTOM_BREAKPOINTS[bp];
      const severity: Severity = known ? "P3" : "P2";
      findings.push({
        severity,
        category: "breakpoint",
        pillar: "design-fidelity",
        check: "F1: Breakpoints use standard set",
        message: known
          ? `Custom breakpoint ${bp}px (known: ${known}) — consider migrating to standard`
          : `Non-standard breakpoint ${bp}px`,
        file: filePath,
        line: lineNum,
        actual: `${bp}px`,
        expected: "768, 992, or 1440px",
      });
    }
  }
}

// ─── Z-INDEX SCANNER ─────────────────────────────────────

function scanZIndex(
  line: string,
  lineNum: number,
  filePath: string,
  findings: AuditFinding[],
): void {
  Z_INDEX_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = Z_INDEX_PATTERN.exec(line)) !== null) {
    const z = parseInt(match[1], 10);
    if (/Z_INDICES|EXTRA_Z_INDICES|zIndices/.test(line)) continue;

    if (!Z_INDICES.has(z)) {
      findings.push({
        severity: "P3",
        category: "component",
        pillar: "design-fidelity",
        check: "D4: Z-index uses tokens",
        message: `Hardcoded z-index ${z} — use Z_INDICES or EXTRA_Z_INDICES`,
        file: filePath,
        line: lineNum,
        actual: `${z}`,
        expected: "Use Z_INDICES.* or EXTRA_Z_INDICES.*",
      });
    }
  }
}
