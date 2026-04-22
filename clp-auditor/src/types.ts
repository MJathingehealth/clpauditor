export type Severity = "P0" | "P1" | "P2" | "P3";

export type Category =
  | "conversion"
  | "accessibility"
  | "design-quality"
  | "optimization"
  | "typography"
  | "color"
  | "spacing"
  | "component"
  | "device-frame"
  | "breakpoint";

export type Pillar = "code-quality" | "design-fidelity";

export interface AuditFinding {
  severity: Severity;
  category: Category;
  pillar: Pillar;
  check: string;
  message: string;
  file: string;
  line?: number;
  actual?: string;
  expected?: string;
}

export interface AuditReport {
  target: string;
  timestamp: string;
  findings: AuditFinding[];
  score: {
    codeQuality: number;
    designFidelity: number;
    overall: number;
  };
}

export interface TokenViolation {
  file: string;
  line: number;
  column: number;
  property: string;
  value: string;
  nearestToken?: string;
  category: Category;
}
