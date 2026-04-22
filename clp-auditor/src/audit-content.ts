/**
 * Content Completeness Checker
 *
 * Scans page template files and component usage for content issues:
 * - Missing/empty hero headlines
 * - Missing CTA buttons
 * - Zero-cost badge without text
 * - Disclaimer logic gaps
 * - Unknown component types in SectionComponentFactory
 * - Client override validation
 */

import { readFileSync } from "fs";
import type { AuditFinding } from "./types.js";

// ─── KNOWN COMPONENT TYPES ──────────────────────────────

// All component types recognized by SectionComponentFactory
// Source: src/sections/SectionComponentFactory/utils/sectionComponentFactoryConfiguration.tsx
const KNOWN_COMPONENT_TYPES = new Set([
  "ContentfulBasicHero",
  "ContentfulBasicTestimonial",
  "ContentfulBlockQuote",
  "ContentfulBodyPartSelector",
  "ContentfulBulletList",
  "ContentfulButtonForm",
  "ContentfulCarousel",
  "ContentfulCarouselHero",
  "ContentfulCarouselSection",
  "ContentfulChatBot",
  "ContentfulClpInteractiveCta",
  "ContentfulCtaSection",
  "ContentfulDisclaimer",
  "ContentfulDropdown",
  "ContentfulFaqTabbed",
  "ContentfulFlexibleBulletListCardColumn",
  "ContentfulFlexibleCardColumn",
  "ContentfulImageAndTextTestimonial",
  "ContentfulIncentiveBanner",
  "ContentfulInteractiveCta",
  "ContentfulLogoMarquee",
  "ContentfulPopUpModal",
  "ContentfulPriceDescription",
  "ContentfulProgramFeature",
  "ContentfulReferral",
  "ContentfulReferencesSection",
  "ContentfulRichText",
  "ContentfulSectionAppTour",
  "ContentfulSectionFaq",
  "ContentfulSectionImage",
  "ContentfulSectionTitle",
  "ContentfulSectionVideo",
  "ContentfulSidewaysContentColumn",
  "ContentfulSocialProof",
  "ContentfulSpotlight",
  "ContentfulStatsRow",
  "ContentfulStatsVisualizer",
  "ContentfulStickyBrandBar",
  "ContentfulTabbedProgramFeature",
  "ContentfulTestimonialSection",
  "ContentfulTextBanner",
  "ContentfulWebPlaylist",
]);

// Known client identifiers (subset — extend as needed)
const KNOWN_CLIENT_OVERRIDES = new Set([
  "amazon", "amex", "bankofamerica", "benefitsenroll",
  "nhc", "mit", "mitship", "bcbsmn", "uhyadvisors", "avnet",
]);

// ─── SCANNERS ────────────────────────────────────────────

/**
 * Scan a page template file for content completeness issues.
 */
export function scanPageTemplate(filePath: string): AuditFinding[] {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const findings: AuditFinding[] = [];

  // Check 1: Hero has header prop
  checkHeroHeader(content, filePath, findings);

  // Check 2: Hero has buttonList / CTA
  checkHeroCTA(content, filePath, findings);

  // Check 3: Zero-cost badge consistency
  checkZeroCostBadge(content, filePath, findings);

  // Check 4: Disclaimer is generated
  checkDisclaimer(content, filePath, findings);

  // Check 5: Enrollment state handling
  checkEnrollmentState(content, filePath, findings);

  // Check 6: Client override references
  checkClientOverrides(content, filePath, findings);

  return findings;
}

/**
 * Scan a SectionComponentFactory config or usage for unknown types.
 */
export function scanComponentFactory(filePath: string): AuditFinding[] {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const findings: AuditFinding[] = [];

  // Look for component type strings
  const typePattern = /["']Contentful\w+["']/g;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    typePattern.lastIndex = 0;

    while ((match = typePattern.exec(line)) !== null) {
      const type = match[0].replace(/["']/g, "");
      if (!KNOWN_COMPONENT_TYPES.has(type)) {
        findings.push({
          severity: "P0",
          category: "conversion",
          pillar: "code-quality",
          check: "#5: No silently dropped sections",
          message: `Component type "${type}" is not in COMPOSABLE_COMPONENT_CONFIG_MAP — this section will be silently dropped from the page`,
          file: filePath,
          line: i + 1,
          actual: type,
          expected: "A recognized Contentful component type",
        });
      }
    }
  }

  return findings;
}

// ─── INDIVIDUAL CHECKS ───────────────────────────────────

function checkHeroHeader(
  content: string,
  filePath: string,
  findings: AuditFinding[],
): void {
  // Check if BasicHero is used and header is handled
  if (!content.includes("BasicHero")) return;

  // Look for header being passed as empty or potentially empty
  const emptyHeaderPatterns = [
    /header\s*[=:]\s*["']["']/,        // header = "" or header: ""
    /header\s*[=:]\s*undefined/,
    /header\s*[=:]\s*null/,
    /header\s*:\s*""\s*,/,
  ];

  for (const pattern of emptyHeaderPatterns) {
    if (pattern.test(content)) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          findings.push({
            severity: "P0",
            category: "conversion",
            pillar: "code-quality",
            check: "#2: Hero headline is non-empty",
            message: "BasicHero header appears to be empty or undefined — this renders blank space above the fold",
            file: filePath,
            line: i + 1,
          });
          break;
        }
      }
    }
  }
}

function checkHeroCTA(
  content: string,
  filePath: string,
  findings: AuditFinding[],
): void {
  if (!content.includes("BasicHero")) return;

  // Check for shouldHideButton without enrollment checks
  if (content.includes("shouldHideButton") && !content.includes("enrollmentOpen")) {
    findings.push({
      severity: "P0",
      category: "conversion",
      pillar: "code-quality",
      check: "#1: Hero has a visible CTA",
      message: "shouldHideButton is used without enrollmentOpen check — CTA may be incorrectly hidden",
      file: filePath,
    });
  }

  // Check for empty buttonList
  if (/buttonList\s*[=:]\s*\[\s*\]/.test(content)) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/buttonList\s*[=:]\s*\[\s*\]/.test(lines[i])) {
        findings.push({
          severity: "P0",
          category: "conversion",
          pillar: "code-quality",
          check: "#1: Hero has a visible CTA",
          message: "buttonList is an empty array — no CTA will render",
          file: filePath,
          line: i + 1,
        });
        break;
      }
    }
  }
}

function checkZeroCostBadge(
  content: string,
  filePath: string,
  findings: AuditFinding[],
): void {
  // Check if zero cost badge is shown but text might be empty
  if (content.includes("showZeroCostBadge") && content.includes("zeroCostBadgeText")) {
    // Check for pattern where badge shown but text not validated
    if (!/zeroCostBadgeText\s*(?:&&|\?\?)/.test(content) &&
        !/zeroCostBadgeText\s*!\s*=/.test(content) &&
        content.includes("showZeroCostBadge")) {
      findings.push({
        severity: "P1",
        category: "conversion",
        pillar: "code-quality",
        check: "#3: Zero-cost badge consistency",
        message: "showZeroCostBadge is used but zeroCostBadgeText may not be validated — could render an empty badge",
        file: filePath,
      });
    }
  }
}

function checkDisclaimer(
  content: string,
  filePath: string,
  findings: AuditFinding[],
): void {
  // Check if page uses disclaimer but doesn't validate it
  if (content.includes("disclaimerText") || content.includes("generateDisclaimerText")) {
    // Look for disclaimer being rendered without empty check
    if (content.includes("disclaimerText") && !content.includes("disclaimerText &&") &&
        !content.includes("disclaimerText ?") && !content.includes("disclaimerText !==")) {
      findings.push({
        severity: "P1",
        category: "conversion",
        pillar: "code-quality",
        check: "#4: Disclaimer is present",
        message: "disclaimerText used without empty-check — could render empty disclaimer section",
        file: filePath,
      });
    }
  }
}

function checkEnrollmentState(
  content: string,
  filePath: string,
  findings: AuditFinding[],
): void {
  // Check if enrollment flags are destructured but not consistently used
  if (content.includes("enrollmentOpen") && content.includes("waitlistAvailable")) {
    // Good — both flags are present
    return;
  }

  if (content.includes("enrollmentOpen") && !content.includes("waitlistAvailable")) {
    findings.push({
      severity: "P3",
      category: "optimization",
      pillar: "code-quality",
      check: "#18: Enrollment state consistent",
      message: "enrollmentOpen is checked but waitlistAvailable is not — may miss waitlist-eligible users",
      file: filePath,
    });
  }
}

function checkClientOverrides(
  content: string,
  filePath: string,
  findings: AuditFinding[],
): void {
  // Check for hardcoded translation keys that might not exist
  const i18nKeyPattern = /["'](DmcFull\.\w+\.\w+|Enso\.\w+\.\w+|Back\.\w+\.\w+)["']/g;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    i18nKeyPattern.lastIndex = 0;

    while ((match = i18nKeyPattern.exec(line)) !== null) {
      const key = match[1];
      // Flag cross-client key usage (e.g., amex using amazon key)
      if (/amazon/i.test(key) && !/amazon/i.test(filePath)) {
        findings.push({
          severity: "P2",
          category: "design-quality",
          pillar: "code-quality",
          check: "#14: Translation keys exist",
          message: `Uses Amazon-specific translation key "${key}" — likely a copy-paste error`,
          file: filePath,
          line: i + 1,
          actual: key,
          expected: "Client-specific translation key",
        });
      }
    }
  }
}
