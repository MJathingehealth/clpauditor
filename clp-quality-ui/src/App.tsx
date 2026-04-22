import { useState, useRef, useCallback, useEffect } from "react";
import "./styles.css";

type ViewMode = "mobile" | "desktop";

interface Finding {
  severity: string;
  category: string;
  title: string;
  message: string;
  element?: string;
  screenshot?: string;
  screenshotDesktop?: string;
}

interface AuditResult {
  url: string;
  timestamp: string;
  fullScreenshot?: string;
  fullScreenshotDesktop?: string;
  loadTimeMs: number;
  score: { overall: number; cta: number; accessibility: number; designSystem: number; images: number; seo: number };
  summary: { total: number; p0: number; p1: number; p2: number; p3: number; passed: number };
  findings: Finding[];
  passed: { category: string; title: string }[];
}

const SEVERITY_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  P0: { emoji: "🚨", label: "EMERGENCY", color: "#fff", bg: "#E53935" },
  P1: { emoji: "😬", label: "YIKES", color: "#000", bg: "#FFB300" },
  P2: { emoji: "🤔", label: "HMM", color: "#fff", bg: "#5C6BC0" },
  P3: { emoji: "💅", label: "NITPICK", color: "#fff", bg: "#78909C" },
};

const CATEGORY_ICONS: Record<string, string> = {
  cta: "🎯",
  content: "📝",
  accessibility: "♿",
  typography: "🔤",
  color: "🎨",
  spacing: "📐",
  performance: "⚡",
  seo: "🔍",
  compliance: "📜",
};

const SCORE_EMOJI: Record<string, string> = {
  cta: "🎯",
  accessibility: "♿",
  designSystem: "🧬",
  images: "🖼️",
  seo: "🔍",
};

const LOADING_MESSAGES = [
  "🔍 Fetching the page...",
  "🤖 Putting on our reading glasses...",
  "📐 Measuring all the pixels...",
  "🎨 Judging your color choices...",
  "🔤 Squinting at your fonts...",
  "📸 Taking receipts (screenshots)...",
  "✍️ Writing up the roast...",
];

function getScoreVerdict(score: number): { emoji: string; text: string } {
  if (score >= 95) return { emoji: "🏆", text: "Chef's kiss" };
  if (score >= 85) return { emoji: "✨", text: "Looking good" };
  if (score >= 70) return { emoji: "😅", text: "Needs love" };
  if (score >= 50) return { emoji: "😰", text: "Oof" };
  if (score >= 25) return { emoji: "💀", text: "RIP" };
  return { emoji: "☠️", text: "Send help" };
}

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

function getOverallReaction(score: number): string {
  if (score >= 95) return pick([
    "Immaculate. Frame this and put it on the wall.",
    "This page did its homework, ate breakfast, and showed up early.",
    "Standing ovation. Whoever made this, give them a raise.",
    "We tried to find problems. We failed. Congrats.",
    "This is suspiciously good. Are you sure it's production?",
  ]);
  if (score >= 85) return pick([
    "Solid work! A few things to polish, but you're close.",
    "Almost there. Like 'forgot to save the last edit' close.",
    "B+ energy. Your design system teacher would be proud-ish.",
    "90% of the way to perfect. The last 10% is where heroes are made.",
    "Good bones. Just needs a little moisturizer.",
  ]);
  if (score >= 70) return pick([
    "Not bad, but your design system is giving side-eye.",
    "It works! ...in the way a car with a check engine light 'works.'",
    "Your page called. It said it deserves better.",
    "Passing grade, but we both know you can do better.",
    "Like showing up to a meeting 5 minutes late. Technically fine. Spiritually wrong.",
  ]);
  if (score >= 50) return pick([
    "We need to talk. Bring snacks, it's gonna be a long one.",
    "This page has 'it was 5pm on a Friday' energy.",
    "Somewhere, a design system is crying into its tokens.",
    "The good news: it loads. The bad news: everything else.",
    "Let's call this a 'growth opportunity' and leave it at that.",
    "Your page is on a journey. Unfortunately, it's the wrong direction.",
  ]);
  if (score >= 25) return pick([
    "This page is a cry for help. We heard it.",
    "Alert the design team. Actually, alert everyone.",
    "Pixels were harmed in the making of this page.",
    "This is what happens when you skip design review.",
    "We've seen things. We can't unsee them.",
    "Even the 404 page is embarrassed to be associated.",
  ]);
  return pick([
    "Respectfully... who shipped this?",
    "We regret to inform you: this page has flatlined.",
    "The audit is done. Therapy is recommended.",
    "This isn't a page, it's a crime scene.",
    "If this page were a patient, we'd be calling next of kin.",
    "Delete the deploy. Touch grass. Start over.",
  ]);
}

interface Annotation {
  type: string;
  severity: string;
  message: string;
  figmaValue?: string;
  codeValue?: string;
}

interface FigmaSectionResult {
  name: string;
  index: number;
  figmaScreenshot: string;
  pageScreenshot: string;
  diffScreenshot: string;
  similarity: number;
  diffPixels: number;
  totalPixels: number;
  annotations: Annotation[];
}

interface FigmaCompareResult {
  figmaUrl: string;
  pageUrl: string;
  timestamp: string;
  figmaNodeName: string;
  figmaWidth: number;
  figmaHeight: number;
  viewport: "mobile" | "desktop";
  figmaScreenshot: string;
  pageScreenshot: string;
  diffScreenshot: string;
  overallSimilarity: number;
  sections: FigmaSectionResult[];
  annotations: Annotation[];
  score: number;
  summary: { matches: number; close: number; mismatches: number; total: number };
}

type Tab = "audit" | "figma";

export default function App() {
  const [tab, setTab] = useState<Tab>("audit");

  // Audit state
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("mobile");
  const [loadingMsg, setLoadingMsg] = useState(0);

  // Figma compare state
  const [figmaUrl, setFigmaUrl] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaResult, setFigmaResult] = useState<FigmaCompareResult | null>(null);
  const [figmaError, setFigmaError] = useState("");

  const filteredFindings = result?.findings.filter(f => !filter || f.severity === filter) || [];
  const getScreenshot = (f: Finding) => viewMode === "desktop" ? (f.screenshotDesktop || f.screenshot) : f.screenshot;
  const getFullScreenshot = () => viewMode === "desktop" ? (result?.fullScreenshotDesktop || result?.fullScreenshot) : result?.fullScreenshot;

  async function handleAudit() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setFilter(null);
    setLoadingMsg(0);

    const msgInterval = setInterval(() => {
      setLoadingMsg(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
    }
  }

  async function handleFigmaCompare() {
    if (!figmaUrl.trim() || !pageUrl.trim()) return;
    setFigmaLoading(true);
    setFigmaError("");
    setFigmaResult(null);

    try {
      const res = await fetch("/api/figma-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaUrl: figmaUrl.trim(), pageUrl: pageUrl.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setFigmaResult(await res.json());
    } catch (err: any) {
      setFigmaError(err.message);
    } finally {
      setFigmaLoading(false);
    }
  }

  return (
    <div className="app">
      {expandedScreenshot && (
        <div className="lightbox" onClick={() => setExpandedScreenshot(null)}>
          <img src={expandedScreenshot} alt="Screenshot" className="lightbox__img" />
          <span className="lightbox__close">tap anywhere to escape</span>
        </div>
      )}

      {/* ─── Hero Header ─── */}
      <header className="header">
        <div className="header__inner">
          <div className="header__top">
            <span className="header__tagline">hackfest 2026</span>
          </div>
          <h1 className="header__title">
            Page Quality Clinic
          </h1>
          <p className="header__subtitle">
            Drop a URL. We'll tell you what's broken, what's ugly, and what's just... <em>off</em>.
          </p>
          <div className="tab-bar">
            <button className={`tab-bar__btn ${tab === "audit" ? "tab-bar__btn--on" : ""}`} onClick={() => setTab("audit")}>
              🩺 Quality Audit
            </button>
            <button className={`tab-bar__btn ${tab === "figma" ? "tab-bar__btn--on" : ""}`} onClick={() => setTab("figma")}>
              🎨 Figma vs Code
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {/* ═══ TAB 1: Quality Audit ═══ */}
        {tab === "audit" && <>
        <div className="search-bar">
          <div className="search-bar__icon">🔗</div>
          <input
            className="search-bar__input"
            type="url"
            placeholder="Paste any URL and hit enter..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAudit()}
          />
          <button
            className="search-bar__btn"
            onClick={handleAudit}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <><span className="search-bar__btn-spinner" /> Auditing...</>
            ) : (
              <>Run Checkup 🏥</>
            )}
          </button>
        </div>

        {error && (
          <div className="error-msg">
            <span className="error-msg__emoji">💥</span>
            <div>
              <strong>Whoops!</strong> {error}
            </div>
          </div>
        )}

        {/* ─── Loading ─── */}
        {loading && (
          <div className="loading">
            <div className="loading__animation">
              <span className="loading__blob loading__blob--1" />
              <span className="loading__blob loading__blob--2" />
              <span className="loading__blob loading__blob--3" />
            </div>
            <p className="loading__msg" key={loadingMsg}>{LOADING_MESSAGES[loadingMsg]}</p>
          </div>
        )}

        {/* ─── Results ─── */}
        {result && (
          <div className="results">
            {/* Overall Verdict */}
            <div className="verdict" style={{ animationDelay: "0s" }}>
              <div className="verdict__score-ring">
                <svg viewBox="0 0 120 120" className="verdict__svg">
                  <circle cx="60" cy="60" r="52" className="verdict__track" />
                  <circle
                    cx="60" cy="60" r="52"
                    className="verdict__fill"
                    style={{
                      strokeDasharray: `${result.score.overall * 3.267} 326.7`,
                      stroke: result.score.overall >= 70 ? "oklch(0.65 0.2 145)" : result.score.overall >= 40 ? "oklch(0.7 0.18 85)" : "oklch(0.6 0.22 25)",
                    }}
                  />
                </svg>
                <div className="verdict__score-text">
                  <span className="verdict__number">{result.score.overall}</span>
                  <span className="verdict__of">/100</span>
                </div>
              </div>
              <div className="verdict__copy">
                <span className="verdict__emoji">{getScoreVerdict(result.score.overall).emoji}</span>
                <h2 className="verdict__headline">{getScoreVerdict(result.score.overall).text}</h2>
                <p className="verdict__roast">{getOverallReaction(result.score.overall)}</p>
                <div className="verdict__meta">
                  <span>⏱ {result.loadTimeMs}ms</span>
                  <span>📋 {result.summary.total} findings</span>
                  <span>✅ {result.summary.passed} passed</span>
                </div>
              </div>
            </div>

            {/* Category Scores */}
            <div className="cat-scores" style={{ animationDelay: "0.1s" }}>
              {(["cta", "accessibility", "designSystem", "images", "seo"] as const).map((key) => {
                const score = result.score[key];
                const v = getScoreVerdict(score);
                const labels: Record<string, string> = { cta: "CTAs", accessibility: "Accessibility", designSystem: "Design System", images: "Images", seo: "SEO" };
                return (
                  <div className="cat-score" key={key}>
                    <div className="cat-score__top">
                      <span className="cat-score__icon">{SCORE_EMOJI[key]}</span>
                      <span className="cat-score__val" style={{ color: score >= 70 ? "oklch(0.45 0.15 145)" : score >= 40 ? "oklch(0.5 0.15 85)" : "oklch(0.5 0.2 25)" }}>{score}</span>
                    </div>
                    <span className="cat-score__label">{labels[key]}</span>
                    <span className="cat-score__verdict">{v.emoji} {v.text}</span>
                  </div>
                );
              })}
            </div>

            {/* Filter Pills */}
            <div className="filter-bar" style={{ animationDelay: "0.15s" }}>
              <div className="filter-bar__pills">
                <button className={`fpill ${!filter ? "fpill--on" : ""}`} onClick={() => setFilter(null)}>
                  All <span className="fpill__count">{result.summary.total}</span>
                </button>
                {result.summary.p0 > 0 && (
                  <button className={`fpill fpill--fire ${filter === "P0" ? "fpill--on" : ""}`} onClick={() => setFilter(filter === "P0" ? null : "P0")}>
                    🚨 Emergency <span className="fpill__count">{result.summary.p0}</span>
                  </button>
                )}
                {result.summary.p1 > 0 && (
                  <button className={`fpill fpill--yikes ${filter === "P1" ? "fpill--on" : ""}`} onClick={() => setFilter(filter === "P1" ? null : "P1")}>
                    😬 Yikes <span className="fpill__count">{result.summary.p1}</span>
                  </button>
                )}
                {result.summary.p2 > 0 && (
                  <button className={`fpill fpill--hmm ${filter === "P2" ? "fpill--on" : ""}`} onClick={() => setFilter(filter === "P2" ? null : "P2")}>
                    🤔 Hmm <span className="fpill__count">{result.summary.p2}</span>
                  </button>
                )}
                {result.summary.p3 > 0 && (
                  <button className={`fpill fpill--nitpick ${filter === "P3" ? "fpill--on" : ""}`} onClick={() => setFilter(filter === "P3" ? null : "P3")}>
                    💅 Nitpick <span className="fpill__count">{result.summary.p3}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Page Screenshot */}
            {result.fullScreenshot && (
              <div className="page-preview" style={{ animationDelay: "0.2s" }}>
                <div className="page-preview__header">
                  <h3 className="page-preview__title">📸 The Evidence</h3>
                  <div className="vp-toggle">
                    <button className={`vp-toggle__btn ${viewMode === "mobile" ? "vp-toggle__btn--on" : ""}`} onClick={() => setViewMode("mobile")}>📱 Mobile</button>
                    <button className={`vp-toggle__btn ${viewMode === "desktop" ? "vp-toggle__btn--on" : ""}`} onClick={() => setViewMode("desktop")}>🖥 Desktop</button>
                  </div>
                </div>
                <img
                  src={getFullScreenshot()!}
                  alt={`Full page (${viewMode})`}
                  className={`page-preview__img ${viewMode === "desktop" ? "page-preview__img--wide" : ""}`}
                  onClick={() => setExpandedScreenshot(getFullScreenshot()!)}
                />
              </div>
            )}

            {/* Passed Checks */}
            {!filter && result.passed.length > 0 && (
              <div className="passed" style={{ animationDelay: "0.25s" }}>
                <h3 className="passed__title">✅ Nailed It ({result.passed.length})</h3>
                <div className="passed__grid">
                  {result.passed.map((p, i) => (
                    <div className="passed__item" key={i}>
                      <span>{CATEGORY_ICONS[p.category] || "✓"}</span>
                      <span>{p.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Findings */}
            <div className="findings">
              {filteredFindings.map((f, i) => {
                const sev = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.P3;
                return (
                  <div className={`fcard fcard--${f.severity.toLowerCase()}`} key={i} style={{ animationDelay: `${0.3 + i * 0.04}s` }}>
                    <div className="fcard__top">
                      <span className="fcard__sev" style={{ background: sev.bg, color: sev.color }}>
                        {sev.emoji} {sev.label}
                      </span>
                      <span className="fcard__cat">{CATEGORY_ICONS[f.category] || ""} {f.category}</span>
                    </div>
                    <h4 className="fcard__title">{f.title}</h4>
                    <p className="fcard__msg">{f.message}</p>
                    {f.element && <code className="fcard__code">{f.element}</code>}
                    {getScreenshot(f) && (
                      <img
                        src={getScreenshot(f)!}
                        alt={`${f.title}`}
                        className="fcard__ss"
                        onClick={() => setExpandedScreenshot(getScreenshot(f)!)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Empty State */}
        {!loading && !result && !error && (
          <div className="empty">
            <h2 className="empty__title">No patients yet</h2>
            <p className="empty__text">Paste a URL above and we'll give it a full checkup.<br/>We check CTAs, accessibility, design tokens, images, SEO, and spelling.</p>
            <div className="empty__tags">
              <span>🎯 CTAs</span>
              <span>♿ A11y</span>
              <span>🧬 Design System</span>
              <span>🖼️ Images</span>
              <span>🔍 SEO</span>
              <span>📐 Spacing</span>
              <span>🎨 Colors</span>
              <span>🔤 Typography</span>
              <span>✍️ Spelling</span>
              <span>📜 Compliance</span>
            </div>
          </div>
        )}
        </>}

        {/* ═══ TAB 2: Figma vs Code ═══ */}
        {tab === "figma" && <>
          <div className="figma-inputs">
            <div className="figma-input-row">
              <span className="figma-input-row__icon">🎨</span>
              <input
                className="figma-input-row__field"
                type="url"
                placeholder="Figma URL (with ?node-id=...)"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
              />
            </div>
            <div className="figma-input-row">
              <span className="figma-input-row__icon">🌐</span>
              <input
                className="figma-input-row__field"
                type="url"
                placeholder="Live page URL"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFigmaCompare()}
              />
            </div>
            <button
              className="search-bar__btn"
              onClick={handleFigmaCompare}
              disabled={figmaLoading || !figmaUrl.trim() || !pageUrl.trim()}
              style={{ width: "100%" }}
            >
              {figmaLoading ? "Comparing..." : "Compare Design vs Code 🔍"}
            </button>
          </div>

          {figmaError && (
            <div className="error-msg">
              <span className="error-msg__emoji">💥</span>
              <div><strong>Whoops!</strong> {figmaError}</div>
            </div>
          )}

          {figmaLoading && (
            <div className="loading">
              <div className="loading__animation">
                <span className="loading__blob loading__blob--1" />
                <span className="loading__blob loading__blob--2" />
                <span className="loading__blob loading__blob--3" />
              </div>
              <p className="loading__msg">Fetching Figma design + live page styles...</p>
            </div>
          )}

          {figmaResult && (
            <div className="results">
              {/* Verdict */}
              <div className="verdict" style={{ animationDelay: "0s" }}>
                <div className="verdict__score-ring">
                  <svg viewBox="0 0 120 120" className="verdict__svg">
                    <circle cx="60" cy="60" r="52" className="verdict__track" />
                    <circle cx="60" cy="60" r="52" className="verdict__fill"
                      style={{
                        strokeDasharray: `${figmaResult.overallSimilarity * 3.267} 326.7`,
                        stroke: figmaResult.overallSimilarity >= 90 ? "oklch(0.65 0.2 145)" : figmaResult.overallSimilarity >= 70 ? "oklch(0.7 0.18 85)" : "oklch(0.6 0.22 25)",
                      }}
                    />
                  </svg>
                  <div className="verdict__score-text">
                    <span className="verdict__number">{figmaResult.overallSimilarity}</span>
                    <span className="verdict__of">% match</span>
                  </div>
                </div>
                <div className="verdict__copy">
                  <span className="verdict__emoji">{getScoreVerdict(figmaResult.overallSimilarity).emoji}</span>
                  <h2 className="verdict__headline">Visual Fidelity</h2>
                  <p className="verdict__roast">
                    "{figmaResult.figmaNodeName}" ({figmaResult.figmaWidth}x{figmaResult.figmaHeight}) → {figmaResult.viewport}
                  </p>
                  <div className="verdict__meta">
                    <span>{figmaResult.viewport === "desktop" ? "🖥" : "📱"} {figmaResult.viewport}</span>
                    <span>✅ {figmaResult.summary.matches} identical</span>
                    <span>🤏 {figmaResult.summary.close} close</span>
                    <span>❌ {figmaResult.summary.mismatches} drifted</span>
                    <span>📐 {figmaResult.sections.length} sections</span>
                  </div>
                </div>
              </div>

              {/* Full page: Figma / Code / Diff — 3 columns */}
              <div className="triple-compare" style={{ animationDelay: "0.1s" }}>
                <div className="triple-compare__panel">
                  <span className="triple-compare__label">🎨 Figma</span>
                  <img src={figmaResult.figmaScreenshot} alt="Figma" className="triple-compare__img"
                    onClick={() => setExpandedScreenshot(figmaResult.figmaScreenshot)} />
                </div>
                <div className="triple-compare__panel">
                  <span className="triple-compare__label">🌐 Live Page</span>
                  <img src={figmaResult.pageScreenshot} alt="Page" className="triple-compare__img"
                    onClick={() => setExpandedScreenshot(figmaResult.pageScreenshot)} />
                </div>
                <div className="triple-compare__panel">
                  <span className="triple-compare__label">🔴 Differences</span>
                  <img src={figmaResult.diffScreenshot} alt="Diff" className="triple-compare__img"
                    onClick={() => setExpandedScreenshot(figmaResult.diffScreenshot)} />
                </div>
              </div>

              {/* Per-section diffs — sorted worst first */}
              <h3 className="figma-sections-title" style={{ animationDelay: "0.15s" }}>
                Section-by-Section Breakdown
              </h3>
              <div className="figma-sections">
                {figmaResult.sections.map((sec, i) => {
                  const isGood = sec.similarity >= 95;
                  const isClose = sec.similarity >= 80 && sec.similarity < 95;
                  const statusClass = isGood ? "figma-sec--ok" : isClose ? "figma-sec--close" : "figma-sec--warn";
                  const statusIcon = isGood ? "✅" : isClose ? "🤏" : "❌";
                  const statusLabel = isGood ? "Pixel perfect" : isClose ? "Close but off" : "Visually different";

                  return (
                    <div className={`figma-sec ${statusClass}`} key={i} style={{ animationDelay: `${0.2 + i * 0.04}s` }}>
                      <div className="figma-sec__header">
                        <span className="figma-sec__icon">{statusIcon}</span>
                        <h4 className="figma-sec__name">{sec.name}</h4>
                        <div className="figma-sec__sim">
                          <span className="figma-sec__sim-bar">
                            <span className="figma-sec__sim-fill" style={{
                              width: `${sec.similarity}%`,
                              background: isGood ? "oklch(0.6 0.18 145)" : isClose ? "oklch(0.7 0.15 85)" : "oklch(0.6 0.2 25)",
                            }} />
                          </span>
                          <span className="figma-sec__sim-pct">{sec.similarity}%</span>
                        </div>
                      </div>
                      <p className="figma-sec__status-label">{statusLabel} — {sec.diffPixels.toLocaleString()} pixels differ</p>

                      {/* 3-up: Figma | Code | Diff */}
                      <div className="figma-sec__triple">
                        <div className="figma-sec__triple-panel">
                          <span className="figma-sec__screen-label">Figma</span>
                          <img src={sec.figmaScreenshot} alt="Figma section" className="figma-sec__screen-img"
                            onClick={() => setExpandedScreenshot(sec.figmaScreenshot)} />
                        </div>
                        <div className="figma-sec__triple-panel">
                          <span className="figma-sec__screen-label">Code</span>
                          <img src={sec.pageScreenshot} alt="Page section" className="figma-sec__screen-img"
                            onClick={() => setExpandedScreenshot(sec.pageScreenshot)} />
                        </div>
                        <div className="figma-sec__triple-panel">
                          <span className="figma-sec__screen-label">Diff</span>
                          <img src={sec.diffScreenshot} alt="Diff" className="figma-sec__screen-img figma-sec__screen-img--diff"
                            onClick={() => setExpandedScreenshot(sec.diffScreenshot)} />
                        </div>
                      </div>

                      {/* Annotations for this section */}
                      {sec.annotations.length > 0 && (
                        <div className="ann-list">
                          {sec.annotations.map((ann, ai) => {
                            const icon = ann.type === "copy" ? "📝" : ann.type === "image" ? "🖼️" : ann.type === "font" ? "🔤" : ann.type === "color" ? "🎨" : ann.type === "spacing" ? "📐" : "⚠️";
                            return (
                              <div className={`ann ann--${ann.severity}`} key={ai}>
                                <span className="ann__icon">{icon}</span>
                                <div className="ann__body">
                                  <span className="ann__msg">{ann.message}</span>
                                  {ann.figmaValue && (
                                    <span className="ann__vals">
                                      Figma: <strong>{ann.figmaValue}</strong>
                                      {ann.codeValue && <> → Code: <strong>{ann.codeValue}</strong></>}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Global Annotations */}
              {figmaResult.annotations.length > 0 && (
                <div className="global-anns" style={{ animationDelay: "0.3s" }}>
                  <h3 className="global-anns__title">📋 All Issues Found ({figmaResult.annotations.length})</h3>
                  <div className="global-anns__grid">
                    {figmaResult.annotations.map((ann, i) => {
                      const icon = ann.type === "copy" ? "📝" : ann.type === "image" ? "🖼️" : ann.type === "font" ? "🔤" : ann.type === "color" ? "🎨" : ann.type === "missing-section" ? "🚨" : ann.type === "spacing" ? "📐" : "⚠️";
                      return (
                        <div className={`ann ann--${ann.severity}`} key={i}>
                          <span className="ann__icon">{icon}</span>
                          <div className="ann__body">
                            <span className="ann__msg">{ann.message}</span>
                            {ann.figmaValue && (
                              <span className="ann__vals">
                                Figma: <strong>{ann.figmaValue}</strong>
                                {ann.codeValue && <> → Code: <strong>{ann.codeValue}</strong></>}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Before/After Split Screen */}
              {figmaResult.figmaScreenshot && figmaResult.pageScreenshot && (
                <div className="split-section" style={{ animationDelay: "0.35s" }}>
                  <h3 className="split-section__title">👆 Drag to Compare — Before (Figma) vs After (Code)</h3>
                  <SplitSlider
                    beforeSrc={figmaResult.figmaScreenshot}
                    afterSrc={figmaResult.pageScreenshot}
                    beforeLabel="Figma Design"
                    afterLabel="Production"
                  />
                </div>
              )}
            </div>
          )}

          {/* Figma empty state */}
          {!figmaLoading && !figmaResult && !figmaError && (
            <div className="empty">
              <h2 className="empty__title">Figma vs Code</h2>
              <p className="empty__text">Paste a Figma URL (with a node selected) and a live page URL.<br/>We'll compare fonts, colors, spacing, and dimensions pixel-by-pixel.</p>
              <div className="empty__tags">
                <span>🔤 Font Size</span>
                <span>🅰️ Font Weight</span>
                <span>🎨 Colors</span>
                <span>📐 Padding</span>
                <span>📏 Dimensions</span>
                <span>🔲 Border Radius</span>
                <span>↕️ Gap</span>
              </div>
            </div>
          )}
        </>}
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <JogWheel />
          <div className="site-footer__copy">
            <p className="site-footer__built">Built with questionable taste and zero Figma frames</p>
            <p className="site-footer__event">Design Hackfest 2026 🤘</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SplitSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel }: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { if (dragging.current) handleMove(e.clientX); };
    const onTouchMove = (e: TouchEvent) => { if (dragging.current) handleMove(e.touches[0].clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [handleMove]);

  return (
    <div
      className="split"
      ref={containerRef}
      onMouseDown={(e) => { dragging.current = true; handleMove(e.clientX); }}
      onTouchStart={(e) => { dragging.current = true; handleMove(e.touches[0].clientX); }}
    >
      {/* After (full width, underneath) */}
      <img src={afterSrc} alt={afterLabel} className="split__img split__img--after" draggable={false} />

      {/* Before (clipped to position) */}
      <div className="split__before" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={beforeSrc} alt={beforeLabel} className="split__img" draggable={false} />
      </div>

      {/* Divider line + handle */}
      <div className="split__divider" style={{ left: `${position}%` }}>
        <div className="split__handle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
            <path d="M8 9l-3 3 3 3M16 9l3 3-3 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="split__label split__label--before">🎨 {beforeLabel}</span>
      <span className="split__label split__label--after">🌐 {afterLabel}</span>
    </div>
  );
}

const TRACKS = [
  { name: "Hanging Lanterns", file: "/music/vibin-out.mp3", color: "oklch(0.65 0.19 155)" },
  { name: "Cozy Alone", file: "/music/tadow.mp3", color: "oklch(0.7 0.18 40)" },
  { name: "Lounge Chill", file: "/music/lying-together.mp3", color: "oklch(0.65 0.17 270)" },
  { name: "Let The Rain Fall", file: "/music/go-back-home.mp3", color: "oklch(0.6 0.15 200)" },
  { name: "Lo-Fi Radio", file: "/music/skyline.mp3", color: "oklch(0.7 0.18 85)" },
  { name: "1AM Study Session", file: "/music/street-musik.mp3", color: "oklch(0.65 0.2 10)" },
];

function JogWheel() {
  const [playing, setPlaying] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = TRACKS[trackIdx];

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    audio.src = TRACKS[0].file;
    audioRef.current = audio;

    const onTime = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    audio.addEventListener("timeupdate", onTime);

    // Handle missing file gracefully
    audio.addEventListener("error", () => {
      console.warn(`Track not found: ${audio.src}. Add mp3 files to public/music/`);
    });

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
    };
  }, []);

  // Update source when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const wasPlaying = !audio.paused;
    audio.src = track.file;
    if (wasPlaying) audio.play().catch(() => {});
  }, [trackIdx, track.file]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const nextTrack = () => {
    setTrackIdx((trackIdx + 1) % TRACKS.length);
    if (!playing) {
      setPlaying(true);
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    }
  };

  // Autoplay on first interaction
  useEffect(() => {
    const autoplay = () => {
      const audio = audioRef.current;
      if (audio && audio.paused) {
        audio.play().then(() => setPlaying(true)).catch(() => {});
      }
      window.removeEventListener("click", autoplay);
      window.removeEventListener("keydown", autoplay);
    };
    window.addEventListener("click", autoplay, { once: true });
    window.addEventListener("keydown", autoplay, { once: true });
    return () => {
      window.removeEventListener("click", autoplay);
      window.removeEventListener("keydown", autoplay);
    };
  }, []);

  return (
    <div className="jog">
      <div className={`jog__disc ${playing ? "jog__disc--spinning" : ""}`} onClick={togglePlay}>
        <svg width="56" height="56" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="78" fill="none" stroke={track.color} strokeWidth="3" opacity="0.15" />
          <circle cx="80" cy="80" r="78" fill="none" stroke={track.color} strokeWidth="3"
            strokeDasharray={`${progress * 490} 490`}
            strokeLinecap="round"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dasharray 0.3s" }}
          />
          <circle cx="80" cy="80" r="68" fill="var(--surface-raised)" />
          <circle cx="80" cy="80" r="60" fill="none" stroke="var(--border)" strokeWidth="0.8" />
          <circle cx="80" cy="80" r="48" fill="none" stroke="var(--border)" strokeWidth="0.8" />
          <circle cx="80" cy="80" r="36" fill="none" stroke="var(--border)" strokeWidth="0.8" />
          <circle cx="80" cy="80" r="22" fill={track.color} opacity="0.15" />
          <circle cx="80" cy="80" r="19" fill="var(--surface-raised)" />
          <circle cx="80" cy="80" r="5" fill={track.color} />
          <line x1="80" y1="28" x2="80" y2="12" stroke={track.color} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          {playing ? (
            <>
              <rect x="71" y="70" width="6" height="20" rx="2" fill={track.color} />
              <rect x="83" y="70" width="6" height="20" rx="2" fill={track.color} />
            </>
          ) : (
            <polygon points="72,68 72,94 96,81" fill={track.color} />
          )}
        </svg>
      </div>

      <div className="jog__info">
        <span className="jog__now-playing">{playing ? "♪ now playing" : "tap to vibe"}</span>
        <span className="jog__track" style={{ color: track.color }}>{track.name}</span>
        <span className="jog__bpm">{track.bpm} bpm</span>
      </div>

      <button className="jog__next" onClick={nextTrack} title="Next track">⏭</button>
    </div>
  );
}
