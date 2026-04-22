# Design System Compliance & Figma-to-Code Checker

## Addendum to CLP Quality Auditor — Theme 2

---

## The Two Pillars

### Pillar 1: CLP Quality Auditor
Checks code against its own rules — missing CTAs, broken disclaimers, accessibility gaps.
(Already defined in main requirements doc)

### Pillar 2: Figma-to-Code Design System Checker
Checks that what's rendered in production matches the Figma source of truth — fonts, colors, spacing, component structure, device frames.

Together they answer:
- **Pillar 1:** "Is the page broken?" (code correctness)
- **Pillar 2:** "Does the page match the design?" (design fidelity)

---

## PILLAR 2: Figma-to-Code Checks

### Category A: Typography Drift

The design system uses BrownLLWeb with a defined scale. These checks catch when code diverges from Figma type specs.

| # | Check | What to Compare | Common Drift |
|---|---|---|---|
| A1 | **Font family** | Every text element uses `BrownLLWeb` or falls back to `sans-serif` | Components using system fonts, `inherit` resolving to wrong family, or Google Fonts leaking in |
| A2 | **Font size matches token** | All font sizes map to FONT_SIZES: 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 34, 36, 40, 48, 56px | Hardcoded `15px`, `17px`, `38px` — values between tokens |
| A3 | **Font weight matches token** | All weights map to FONT_WEIGHTS: 300, 400, 500, 600, 700, 900 | Using `bold` keyword (resolves to 700 but ambiguous), or `450`/`550` non-token values |
| A4 | **Line height matches token** | All line heights map to: 100%, 110%, 120%, 130%, 140%, 150% | Hardcoded `1.3`, `22px`, `normal` — mixing units or using non-token values |
| A5 | **Heading hierarchy** | H1 → H2 → H3 follows size progression, no skipped levels | H1 used for styling not semantics, H3 appearing before H2, multiple H1s on page |
| A6 | **Figma text style match** | Figma text style name (e.g., "Heading/H2/Bold") maps to correct component (H2) + weight (700) + size | Figma says H2/32px/700 but code renders 28px/600 |

**How to check:**
- **Code side:** Grep all styled-components for `font-size`, `font-weight`, `font-family`, `line-height`. Flag any value not in the token set.
- **Figma side:** Use Figma MCP `get_design_context` or `scan_text_nodes` to extract all text styles from the design file. Compare against code.
- **Automation:** Extract computed styles from rendered page via Puppeteer/Playwright, compare against Figma node properties.

---

### Category B: Color Drift

The design system has COLORS (Evergreen, Oat, Yellow, Red, Fuchsia, Sand, Grayscale) + EXTRA_COLORS. These checks catch off-palette colors.

| # | Check | What to Compare | Common Drift |
|---|---|---|---|
| B1 | **All colors use tokens** | Every color value maps to COLORS.*, EXTRA_COLORS, or theme.colors.* | Hardcoded `#fbd5f2` instead of `COLORS.FUCHSIA[80]`, `#4c8c43` inline |
| B2 | **Background colors match Figma** | Section backgrounds match Figma fills exactly | Code uses `#F9F9F9` but Figma specifies `#F9F8F6` (OFF_WHITE_BACKGROUND) — subtle but visible |
| B3 | **CTA button colors match** | Primary CTA uses the correct Evergreen/accent color from Figma | Button color drifts when a dev picks a "close enough" green |
| B4 | **Text colors match palette role** | Headers use `theme.colors.main.header`, body uses `theme.colors.main.text` | Hardcoded `#1C1B1F` instead of `COLORS.GRAYSCALE[10]` |
| B5 | **Badge/tag colors match** | Zero-cost badge, incentive tags use correct accent colors | `#fbd5f2` hardcoded in ZeroCostBadge instead of FUCHSIA[80] — already found in codebase |
| B6 | **Hover/active states match** | Interactive element state colors match Figma interaction specs | Hover color is `#00842D` but Figma specifies `#006730` (EVERGREEN[30] vs [50]) |
| B7 | **Opacity/overlay values** | Overlays, shadows, gradients use correct opacity | `rgba(0,0,0,0.5)` vs `rgba(0,0,0,0.3)` — subtle but affects visual weight |
| B8 | **No legacy colors** | Zero usage of LEGACY_COLORS (HOPE_DIAMOND, SEA_FOAM, LIME, AUBERGINE, RASPBERRY, PEACH, HH_ORANGE) | Old components still referencing deprecated palette |

**How to check:**
- **Code side:** Grep for hex values (`#[0-9a-fA-F]{3,8}`), `rgb(`, `rgba(`, `hsl(` across all `.tsx`, `.ts`, `.css` files. Cross-reference against known token values.
- **Figma side:** Extract fill colors from Figma nodes via MCP. Map each to nearest token. Flag any color that doesn't match a token exactly.
- **Automation:** Screenshot comparison + DOM color extraction via Puppeteer.

---

### Category C: Spacing & Layout Drift

The spacing scale is [0, 4, 8, 16, 24, 32, 40, 64, 128, 256, 512]px. These checks catch inconsistent spacing.

| # | Check | What to Compare | Common Drift |
|---|---|---|---|
| C1 | **Padding uses SPACE tokens** | All padding values map to SPACE array | `padding: 30px` (not in scale), `padding: 12px` (between 8 and 16) |
| C2 | **Margin uses SPACE tokens** | All margin values map to SPACE array | `margin-top: 20px` (not in scale — should be 16 or 24) |
| C3 | **Gap values use tokens** | Flex/grid gap matches SPACE scale | `gap: 10px` (between 8 and 16) |
| C4 | **Section spacing matches Figma** | Vertical space between sections matches Figma frame spacing | Figma shows 64px between sections, code has 40px |
| C5 | **Responsive spacing arrays** | Mobile/tablet/desktop spacing uses correct responsive pattern | `pt: [16, 24, 32]` in code but Figma shows [24, 32, 40] |
| C6 | **Max-width consistency** | Content max-widths match design grid | Code has `max-width: 400px` hardcoded, Figma shows 375px mobile container |

**How to check:**
- **Code side:** Grep for `padding`, `margin`, `gap` with px values. Flag any not in SPACE array. Also check styled-system indices map correctly.
- **Figma side:** Extract padding/spacing from auto-layout frames. Compare against code values per breakpoint.

---

### Category D: Component Structure Drift

These checks catch when the component hierarchy, order, or composition diverges from Figma.

| # | Check | What to Compare | Common Drift |
|---|---|---|---|
| D1 | **Section order matches Figma** | Page section sequence matches the Figma prototype flow | Dev reorders sections, or Contentful order differs from design |
| D2 | **Component variant matches** | Code renders the correct variant (e.g., BasicHero vs. VideoHero vs. CarouselHero) | Figma shows VideoHero but code defaults to BasicHero |
| D3 | **Border radius uses RADII** | All rounded corners use RADII tokens: 4, 8, 12, 16, 18px | `border-radius: 10px` or `border-radius: 20px` (not in token set) |
| D4 | **Shadow values match** | Box shadows match Figma elevation specs | No shadow token system exists — shadows hardcoded. Flag any shadow and compare to Figma |
| D5 | **Icon sizes consistent** | Icons use consistent dimensions across same context | BasicHero has icons at 13x10px and 23x18px — no icon size token system |
| D6 | **Button size/style matches** | CTA buttons match Figma specs (padding, border-radius, font-size) | Button padding is 12px 24px in code, Figma shows 16px 32px |

---

### Category E: Device Frame & Mockup Drift

These checks are specific to the phone mockups and device frames used in marketing imagery.

| # | Check | What to Compare | Common Drift |
|---|---|---|---|
| E1 | **Phone model is current** | Device frame matches current-gen phone (not iPhone 12 when we're at iPhone 16) | Outdated device bezels, notch style, or aspect ratio |
| E2 | **Screen content is current** | App screenshot inside device frame shows current app UI | Phone mock shows old app version, outdated navigation, or removed features |
| E3 | **Device dimensions match** | Frame dimensions (width/height/corner radius) match actual device specs | Using 375x667 (iPhone SE) when design targets 393x852 (iPhone 15) |
| E4 | **App screenshots match production** | Embedded app UI matches current production app state | Marketing shows features not yet shipped, or hides features that are live |
| E5 | **Status bar is current** | Phone status bar (time, signal, battery) matches modern iOS/Android | Status bar shows old iOS style or mismatched OS |

**How to check:**
- **Figma side:** Extract device frame component names/dimensions from Figma via MCP. Compare against target device specs.
- **Code side:** Find all phone mock images in codebase (search for "mock", "device", "phone", "iphone" in image URLs and component names). Check last-modified dates.
- **Manual verify:** Compare Contentful CDN hero images containing device frames against current app screenshots.

---

### Category F: Responsive Breakpoint Drift

The design system defines 3 breakpoints (768, 992, 1440px) but code has multiple competing sets.

| # | Check | What to Compare | Common Drift |
|---|---|---|---|
| F1 | **Breakpoints use standard set** | Components use library breakpoints: 768, 992, 1440px | Custom breakpoints: BasicHero uses 450px, nav uses 1100px, ThreeColumnCard uses 965px |
| F2 | **Figma frames match breakpoints** | Figma has frames at 375, 768, 1440px matching code breakpoints | Figma designed at 390px (iPhone 14) but breakpoint is 768px — gap at 375-767px |
| F3 | **Responsive behavior matches** | Show/hide, layout changes at correct breakpoints | Element hides at 768px in code but Figma shows it visible at tablet |
| F4 | **Storybook viewports match** | Storybook viewports (375, 414, 769, 1044, 1440) align with design frames | Storybook uses 1044px desktop but Figma uses 1440px — testing at wrong width |

---

## Implementation: How the Checker Works

### Approach 1: Static Analysis (Fast, No Browser)

```
Input: Figma file URL + Component file path
  ↓
Step 1: Extract design tokens from Figma via MCP
  - Text styles (font, size, weight, line-height, color)
  - Fill colors
  - Spacing (auto-layout padding, gap, item spacing)
  - Corner radius
  - Shadow/elevation
  - Component dimensions
  ↓
Step 2: Extract code tokens from source files
  - Grep styled-components for all CSS properties
  - Map values to design system tokens
  - Flag non-token values
  ↓
Step 3: Compare and produce diff report
  - "Figma: H2 at 32px/700 → Code: 28px/600 — MISMATCH"
  - "Figma: padding 24px → Code: 30px — OFF-TOKEN"
  - "Figma: #006730 → Code: #00842D — WRONG SHADE"
```

### Approach 2: Visual Regression (Slower, High Fidelity)

```
Input: Figma file URL + Live page URL
  ↓
Step 1: Screenshot Figma frame via MCP
Step 2: Screenshot live page via Puppeteer at same viewport
Step 3: Overlay comparison (pixel diff)
Step 4: Extract computed styles from DOM
Step 5: Compare computed styles against Figma properties
Step 6: Produce annotated visual diff
```

### Approach 3: Hybrid (Recommended for Hackfest)

```
Input: Figma node ID + Code file path
  ↓
Step 1: Figma MCP → extract design properties
Step 2: Code analysis → extract styled-component values
Step 3: AI comparison → natural language diff report
  ↓
Output: "The hero section has 4 mismatches:
  1. Headline: Figma=36px/700 BrownLLWeb, Code=32px/600 — font size and weight don't match
  2. CTA button: Figma=Evergreen[40] #007B34, Code=#00842D Evergreen[50] — wrong green shade
  3. Section padding: Figma=64px, Code=40px — should be SPACE[7] not SPACE[6]
  4. Phone mock: Using iPhone 12 frame, current design uses iPhone 15 Pro"
```

---

## Combined Audit Report Format

When both pillars run together, the output looks like:

```
═══════════════════════════════════════════════════
 CLP AUDIT REPORT: /for/accenture
 Date: 2026-04-16 | Agent: CLP Quality Auditor v1
═══════════════════════════════════════════════════

PILLAR 1: CODE QUALITY
───────────────────────
P0 BLOCKERS: 0
P1 ACCESSIBILITY: 2 issues
  • [A11Y] Hero image missing alt text (featuredImageAltText is empty)
  • [A11Y] Subnote link has no link text — screen readers see empty anchor

P2 DESIGN QUALITY: 1 issue
  • [TOKEN] ZeroCostBadge uses hardcoded #fbd5f2 — should be COLORS.FUCHSIA[80]

P3 OPTIMIZATION: 1 issue
  • [FLAG] Incentive banner suppressed despite incentivesApproved=true
    (getClientsWithoutIncentiveBanner overrides for this client)

PILLAR 2: FIGMA-TO-CODE FIDELITY
─────────────────────────────────
TYPOGRAPHY: 3 mismatches
  • Hero headline: Figma=40px/700, Code=36px/700 — size drift
  • Hero subheader: Figma=18px/400, Code=16px/400 — size drift
  • CTA button text: Figma=16px/600, Code=14px/500 — size + weight drift

COLORS: 2 mismatches
  • Hero CTA: Figma=#007B34 (Evergreen 40), Code=#00842D (Evergreen 50)
  • Trust badge bg: Figma=#FFD7CF, Code=#fbd5f2 — wrong accent color

SPACING: 1 mismatch
  • Hero → Trust bar gap: Figma=64px, Code=40px (SPACE[7] vs SPACE[6])

DEVICE FRAMES: 1 issue
  • Phone mock in hero: Using iPhone 12 bezel (2020), design spec is iPhone 15

OVERALL SCORE: 72/100
  Code Quality: 85/100
  Design Fidelity: 60/100
═══════════════════════════════════════════════════
```

---

## Design System Token Reference (for Agent Context)

### Colors (approved palette)
EVERGREEN: [#000, #003617, #00491F, #006730, #007B34, #00842D, #00A749, #0EBB65, #2DD081, #BDE9C9, #D9F2E4, #EAFAF1, #FFF]
GRAYSCALE: [#000, #1C1B1F, #373938, #484649, #676767, #848484, #A0A0A0, #BCBCBC, #D6D6D6, #DDD, #EDEDED, #F9F9F9, #FFF]
OAT: #FFFBED (all scales)
YELLOW: [#FFC600, #FFD74A, #FFE790, #FFEEB2, #FFF5D0]
RED: [#EE3932, #FE5A54, #FF9490, #FAC3C1, #FFDAD9]
FUCHSIA: [#E55CCD, #F87FE2, #FDBEF2, #FBD5F2, #FFE8F9]
SAND: [#CFB991, #E2D2B8, #EAE0D0, #F1EADE]

### Typography
Font: BrownLLWeb, sans-serif
Sizes: 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 34, 36, 40, 48, 56 (px)
Weights: 300, 400, 500, 600, 700, 900
Line Heights: 100%, 110%, 120%, 130%, 140%, 150%

### Spacing
SPACE: [0, 4, 8, 16, 24, 32, 40, 64, 128, 256, 512] (px)

### Border Radius
RADII: xsmall=4, small=8, default=12, medium=16, large=18 (px)

### Breakpoints
Mobile: < 768px
Tablet: >= 768px
Desktop: >= 992px
Large Desktop: >= 1440px

### Z-Index
content=2, footer=1, header=10, dropdown=1000, modal=100000
