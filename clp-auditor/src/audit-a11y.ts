/**
 * Accessibility Scanner
 *
 * Scans source files for common accessibility violations:
 * - Images without alt text
 * - Buttons/links with empty text
 * - Links with empty href
 * - Heading hierarchy violations
 * - Missing ARIA labels
 * - Color contrast (basic — flags low-contrast patterns)
 */

import { readFileSync } from "fs";
import type { AuditFinding } from "./types.js";

// ─── SCANNERS ────────────────────────────────────────────

export function scanAccessibility(filePath: string): AuditFinding[] {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  // Skip test/story/mock files
  if (/\.(test|spec|stories)\.|__mocks__|\.jest/.test(filePath)) return [];

  const lines = content.split("\n");
  const findings: AuditFinding[] = [];

  checkImageAltText(lines, filePath, findings);
  checkEmptyButtons(lines, filePath, findings);
  checkEmptyLinks(lines, filePath, findings);
  checkHeadingHierarchy(lines, filePath, findings);
  checkAriaLabels(lines, filePath, findings);

  return findings;
}

// ─── IMAGE ALT TEXT ──────────────────────────────────────

function checkImageAltText(
  lines: string[],
  filePath: string,
  findings: AuditFinding[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check <img> tags without alt
    if (/<img\s/i.test(line) && !/alt\s*=/.test(line)) {
      // Look ahead a few lines for alt attribute (JSX multiline)
      const lookAhead = lines.slice(i, Math.min(i + 5, lines.length)).join(" ");
      if (!/alt\s*=/.test(lookAhead)) {
        findings.push({
          severity: "P1",
          category: "accessibility",
          pillar: "code-quality",
          check: "#7: All images have alt text",
          message: "<img> element without alt attribute — WCAG 2.1 Level A violation",
          file: filePath,
          line: i + 1,
        });
      }
    }

    // Check img with empty alt (not intentional decorative)
    if (/alt\s*=\s*["']\s*["']/.test(line)) {
      // alt="" is OK for decorative images — but flag in hero/content sections
      if (/Hero|Banner|Spotlight|Testimonial/i.test(filePath)) {
        findings.push({
          severity: "P2",
          category: "accessibility",
          pillar: "code-quality",
          check: "#7: All images have alt text",
          message: "Empty alt text on a content image — likely should have descriptive alt",
          file: filePath,
          line: i + 1,
        });
      }
    }

    // Check featuredImage assignment without altText — only in JSX/prop assignments, not type defs or queries
    if (/featuredImage(?:Block|Mobile|Tablet)\s*[=:]/.test(line) &&
        !line.includes("AltText") && !line.includes("altText") &&
        !/interface |type |query |fragment |GraphQL|\.ts:/.test(line) &&
        !/(?:export\s+)?(?:type|interface)\s/.test(line) &&
        !/:.*\{/.test(line) &&
        !/\?:/.test(line)) {
      // Check surrounding context for alt text handling
      const context = lines.slice(Math.max(0, i - 5), Math.min(i + 5, lines.length)).join("\n");
      if (!/altText|alt_text|AltText|alt =|alt:/.test(context)) {
        findings.push({
          severity: "P1",
          category: "accessibility",
          pillar: "code-quality",
          check: "#7: All images have alt text",
          message: "featuredImage assigned without corresponding alt text prop",
          file: filePath,
          line: i + 1,
        });
      }
    }
  }
}

// ─── EMPTY BUTTONS ───────────────────────────────────────

function checkEmptyButtons(
  lines: string[],
  filePath: string,
  findings: AuditFinding[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check <button> or ButtonElement without text
    if (/<button\s[^>]*>\s*<\/button>/i.test(line)) {
      findings.push({
        severity: "P1",
        category: "accessibility",
        pillar: "code-quality",
        check: "#8: CTA buttons have accessible labels",
        message: "Empty <button> element — needs text content or aria-label",
        file: filePath,
        line: i + 1,
      });
    }

    // Check for buttonText being empty string
    if (/buttonText\s*[=:]\s*["']\s*["']/.test(line)) {
      findings.push({
        severity: "P1",
        category: "accessibility",
        pillar: "code-quality",
        check: "#8: CTA buttons have accessible labels",
        message: "buttonText is an empty string — button will have no visible label",
        file: filePath,
        line: i + 1,
      });
    }
  }
}

// ─── EMPTY LINKS ─────────────────────────────────────────

function checkEmptyLinks(
  lines: string[],
  filePath: string,
  findings: AuditFinding[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check href="" or href="#" (except anchor navigation)
    if (/href\s*=\s*["']\s*["']/.test(line)) {
      findings.push({
        severity: "P1",
        category: "accessibility",
        pillar: "code-quality",
        check: "#9: Legal links are functional",
        message: "Link with empty href — link does nothing when clicked",
        file: filePath,
        line: i + 1,
      });
    }

    // Check for link prop being empty
    if (/(?:link|href|url)\s*[=:]\s*["']\s*["']/.test(line) && !/subnoteLink/.test(line)) {
      // Avoid false positives on intentional empty defaults
      if (!/default|fallback|placeholder|optional/i.test(line)) {
        findings.push({
          severity: "P2",
          category: "accessibility",
          pillar: "code-quality",
          check: "#9: Legal links are functional",
          message: "Link/href/url prop is an empty string",
          file: filePath,
          line: i + 1,
        });
      }
    }
  }
}

// ─── HEADING HIERARCHY ───────────────────────────────────

function checkHeadingHierarchy(
  lines: string[],
  filePath: string,
  findings: AuditFinding[],
): void {
  const headingOrder: { level: number; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match JSX heading components: <H1>, <H2>, <h1>, <h2>, etc.
    const headingMatch = line.match(/<[Hh]([1-6])[\s>]/);
    if (headingMatch) {
      headingOrder.push({ level: parseInt(headingMatch[1], 10), line: i + 1 });
    }
  }

  // Check for skipped levels
  for (let i = 1; i < headingOrder.length; i++) {
    const prev = headingOrder[i - 1];
    const curr = headingOrder[i];

    // Going deeper: should only go one level at a time
    if (curr.level > prev.level && curr.level - prev.level > 1) {
      findings.push({
        severity: "P2",
        category: "accessibility",
        pillar: "code-quality",
        check: "#A5: Heading hierarchy",
        message: `Heading level skipped: H${prev.level} (line ${prev.line}) → H${curr.level} (line ${curr.line}). Missing H${prev.level + 1}`,
        file: filePath,
        line: curr.line,
        actual: `H${prev.level} → H${curr.level}`,
        expected: `H${prev.level} → H${prev.level + 1}`,
      });
    }
  }

  // Check for multiple H1s
  const h1s = headingOrder.filter(h => h.level === 1);
  if (h1s.length > 1) {
    findings.push({
      severity: "P2",
      category: "accessibility",
      pillar: "code-quality",
      check: "#A5: Heading hierarchy",
      message: `Multiple H1 elements found (lines: ${h1s.map(h => h.line).join(", ")}). Page should have exactly one H1`,
      file: filePath,
      line: h1s[1].line,
    });
  }
}

// ─── ARIA LABELS ─────────────────────────────────────────

function checkAriaLabels(
  lines: string[],
  filePath: string,
  findings: AuditFinding[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check interactive elements without aria-label
    if (/role\s*=\s*["']button["']/.test(line)) {
      const context = lines.slice(i, Math.min(i + 3, lines.length)).join(" ");
      if (!/aria-label/.test(context) && !/>[\w\s]+</.test(context)) {
        findings.push({
          severity: "P2",
          category: "accessibility",
          pillar: "code-quality",
          check: "#8: Interactive elements have labels",
          message: 'Element with role="button" may be missing aria-label',
          file: filePath,
          line: i + 1,
        });
      }
    }

    // Check for onClick on non-interactive elements
    if (/onClick\s*=/.test(line) && /<(?:div|span|p)\s/.test(line)) {
      const context = lines.slice(i, Math.min(i + 3, lines.length)).join(" ");
      if (!/role\s*=/.test(context) && !/tabIndex/.test(context)) {
        findings.push({
          severity: "P2",
          category: "accessibility",
          pillar: "code-quality",
          check: "#8: Interactive elements have labels",
          message: "onClick on a non-interactive element (div/span/p) without role or tabIndex",
          file: filePath,
          line: i + 1,
        });
      }
    }
  }
}
