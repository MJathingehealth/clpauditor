#!/usr/bin/env node
/**
 * CLP Auditor — CLI Orchestrator
 *
 * Runs all scanners against a target path and produces a formatted report.
 *
 * Usage:
 *   npx tsx src/run-audit.ts --path <file-or-directory>
 *   npx tsx src/run-audit.ts --path src/sections/BasicHero
 *   npx tsx src/run-audit.ts --path src/pageTemplates/primaryPages/dmcFull
 */

import { program } from "commander";
import { readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import chalk from "chalk";
import { scanFile } from "./audit-tokens.js";
import { scanPageTemplate, scanComponentFactory } from "./audit-content.js";
import { scanAccessibility } from "./audit-a11y.js";
import type { AuditFinding, Severity, AuditReport } from "./types.js";

// ─── FILE DISCOVERY ──────────────────────────────────────

function collectFiles(targetPath: string): string[] {
  const abs = resolve(targetPath);
  const stat = statSync(abs);

  if (stat.isFile()) return [abs];

  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip non-source directories
        if (["node_modules", "dist", "coverage", ".cache", "public", "__mocks__"].includes(entry.name)) continue;
        walk(full);
      } else if (/\.(tsx?|css)$/.test(entry.name) && !/\.(test|spec|stories)\./.test(entry.name)) {
        files.push(full);
      }
    }
  }
  walk(abs);
  return files;
}

// ─── SCORING ─────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<Severity, number> = {
  P0: 25,
  P1: 10,
  P2: 4,
  P3: 1,
};

function calculateScore(findings: AuditFinding[], pillar: string): number {
  const pillarFindings = findings.filter(f => f.pillar === pillar);
  const totalPenalty = pillarFindings.reduce(
    (sum, f) => sum + SEVERITY_WEIGHT[f.severity],
    0,
  );
  return Math.max(0, Math.round(100 - totalPenalty));
}

// ─── REPORT FORMATTING ──────────────────────────────────

function formatReport(target: string, findings: AuditFinding[], basePath: string): void {
  const codeQuality = calculateScore(findings, "code-quality");
  const designFidelity = calculateScore(findings, "design-fidelity");
  const overall = Math.round((codeQuality + designFidelity) / 2);

  const bar = "═".repeat(60);
  const thin = "─".repeat(60);

  console.log("");
  console.log(chalk.bold(bar));
  console.log(chalk.bold(` CLP AUDIT REPORT: ${target}`));
  console.log(chalk.bold(` Date: ${new Date().toISOString().split("T")[0]}`));
  console.log(chalk.bold(bar));

  // ── Summary ──
  const severityCounts: Record<Severity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of findings) severityCounts[f.severity]++;

  console.log("");
  console.log(chalk.bold(" SUMMARY"));
  console.log(` ${colorSeverity("P0")} Blockers:      ${severityCounts.P0}`);
  console.log(` ${colorSeverity("P1")} Accessibility:  ${severityCounts.P1}`);
  console.log(` ${colorSeverity("P2")} Design Quality: ${severityCounts.P2}`);
  console.log(` ${colorSeverity("P3")} Optimization:   ${severityCounts.P3}`);
  console.log(` Total findings: ${findings.length}`);

  // ── Pillar 1: Code Quality ──
  console.log("");
  console.log(chalk.bold(thin));
  console.log(chalk.bold(" PILLAR 1: CODE QUALITY"));
  console.log(thin);

  const codeFindings = findings.filter(f => f.pillar === "code-quality");
  if (codeFindings.length === 0) {
    console.log(chalk.green(" No code quality issues found."));
  } else {
    printFindingsByCategory(codeFindings, basePath);
  }

  // ── Pillar 2: Design Fidelity ──
  console.log("");
  console.log(chalk.bold(thin));
  console.log(chalk.bold(" PILLAR 2: DESIGN FIDELITY"));
  console.log(thin);

  const designFindings = findings.filter(f => f.pillar === "design-fidelity");
  if (designFindings.length === 0) {
    console.log(chalk.green(" No design fidelity issues found."));
  } else {
    printFindingsByCategory(designFindings, basePath);
  }

  // ── Score ──
  console.log("");
  console.log(chalk.bold(bar));
  console.log(chalk.bold(" SCORE"));
  console.log(`   Code Quality:    ${scoreColor(codeQuality)}`);
  console.log(`   Design Fidelity: ${scoreColor(designFidelity)}`);
  console.log(`   Overall:         ${scoreColor(overall)}`);
  console.log(chalk.bold(bar));
  console.log("");
}

function printFindingsByCategory(findings: AuditFinding[], basePath: string): void {
  // Group by category
  const grouped = new Map<string, AuditFinding[]>();
  for (const f of findings) {
    const key = f.category;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  }

  // Sort categories by highest severity
  const severityOrder: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const sortedCategories = [...grouped.entries()].sort((a, b) => {
    const aMax = Math.min(...a[1].map(f => severityOrder[f.severity]));
    const bMax = Math.min(...b[1].map(f => severityOrder[f.severity]));
    return aMax - bMax;
  });

  for (const [category, catFindings] of sortedCategories) {
    console.log("");
    console.log(chalk.bold.underline(` ${category.toUpperCase()} (${catFindings.length})`));

    for (const f of catFindings) {
      const relPath = relative(basePath, f.file);
      const loc = f.line ? `${relPath}:${f.line}` : relPath;

      console.log(`   ${colorSeverity(f.severity)} ${f.message}`);
      console.log(chalk.gray(`      ${loc}`));

      if (f.actual && f.expected) {
        console.log(chalk.red(`      actual:   ${f.actual}`));
        console.log(chalk.green(`      expected: ${f.expected}`));
      }
    }
  }
}

function colorSeverity(severity: Severity): string {
  switch (severity) {
    case "P0": return chalk.bgRed.white.bold(` ${severity} `);
    case "P1": return chalk.bgYellow.black.bold(` ${severity} `);
    case "P2": return chalk.bgBlue.white(` ${severity} `);
    case "P3": return chalk.bgGray.white(` ${severity} `);
  }
}

function scoreColor(score: number): string {
  if (score >= 90) return chalk.green.bold(`${score}/100`);
  if (score >= 70) return chalk.yellow.bold(`${score}/100`);
  return chalk.red.bold(`${score}/100`);
}

// ─── JSON OUTPUT ─────────────────────────────────────────

function outputJson(target: string, findings: AuditFinding[]): void {
  const report: AuditReport = {
    target,
    timestamp: new Date().toISOString(),
    findings,
    score: {
      codeQuality: calculateScore(findings, "code-quality"),
      designFidelity: calculateScore(findings, "design-fidelity"),
      overall: Math.round(
        (calculateScore(findings, "code-quality") +
          calculateScore(findings, "design-fidelity")) / 2,
      ),
    },
  };
  console.log(JSON.stringify(report, null, 2));
}

// ─── MAIN ────────────────────────────────────────────────

program
  .name("clp-auditor")
  .description("CLP Quality Auditor + Design System Checker")
  .requiredOption("-p, --path <path>", "File or directory to audit")
  .option("-j, --json", "Output as JSON instead of formatted report")
  .option("-s, --severity <level>", "Minimum severity to show (P0, P1, P2, P3)", "P3")
  .parse();

const opts = program.opts();
const targetPath = resolve(opts.path);
const minSeverity = opts.severity as Severity;
const severityLevel: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

console.log(chalk.gray(`Scanning: ${targetPath}`));

const files = collectFiles(targetPath);
console.log(chalk.gray(`Found ${files.length} source files`));

let allFindings: AuditFinding[] = [];

for (const file of files) {
  // Token scan (design fidelity)
  allFindings.push(...scanFile(file));

  // Content scan (code quality)
  allFindings.push(...scanPageTemplate(file));
  allFindings.push(...scanComponentFactory(file));

  // Accessibility scan
  allFindings.push(...scanAccessibility(file));
}

// Filter by minimum severity
allFindings = allFindings.filter(
  f => severityLevel[f.severity] <= severityLevel[minSeverity],
);

// Deduplicate (same file + line + check)
const seen = new Set<string>();
allFindings = allFindings.filter(f => {
  const key = `${f.file}:${f.line}:${f.check}:${f.actual}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Sort: P0 first, then by file
allFindings.sort((a, b) => {
  const sevDiff = severityLevel[a.severity] - severityLevel[b.severity];
  if (sevDiff !== 0) return sevDiff;
  return a.file.localeCompare(b.file);
});

if (opts.json) {
  outputJson(targetPath, allFindings);
} else {
  formatReport(relative(process.cwd(), targetPath) || targetPath, allFindings, resolve("."));
}

process.exit(allFindings.some(f => f.severity === "P0") ? 1 : 0);
