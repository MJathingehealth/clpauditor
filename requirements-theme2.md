# CLP Quality Auditor — "Design Doppelganger"

## AI x Design Hackfest 2026 — Theme 2: "Build Your Doppelganger"

**Author:** Murari Jha, Design Lead — Consumer Web
**Date:** April 16, 2026
**Agent Name:** CLP Auditor

---

## The Paperwork Problem

Hinge Health has **197+ client landing pages** generated from a shared template system. Each page is a combination of:
- Contentful CMS data (hero copy, images, CTAs, disclaimers, incentive flags)
- Client-specific overrides (hardcoded in `clientOverrides.tsx`)
- Experiment flags (Split.io treatments)
- Theme tokens (colors, spacing, typography)
- Legal/compliance requirements (disclaimers, legal links, cookie settings)

**Today, quality assurance is manual.** A designer or QA person opens a page, scrolls through it, and visually checks that things look right. There's no systematic way to catch:
- A client page that shipped with **no CTA** (this has happened — Amazon Prevention, Aetna Find)
- A **$0 cost badge** rendering empty because the text field is blank in Contentful
- A **disclaimer** that contradicts the badge above it (the asterisk trust problem)
- **Images without alt text** — accessibility violations hiding in plain sight
- A **client override** referencing a translation key that doesn't exist
- A new **Contentful component type** that the factory doesn't recognize — silently dropped from the page

**The result:** Bugs are found by accident, by users, or during occasional manual audits. By then they've been live for days or weeks, silently hurting conversion and compliance.

---

## What We're Building

A **CLP Quality Auditor agent** — a persona-engineered AI system that can audit any Hinge Health client landing page with the same rigor as a senior designer + QA engineer, but across all 197 pages in minutes instead of days.

### The Agent's Persona

> "You are a Senior Design QA Engineer at Hinge Health. You have deep knowledge of the MWEB design system, Contentful CMS schema, accessibility standards (WCAG 2.2 AA), and CLP conversion best practices. You audit client landing pages for quality, consistency, compliance, and conversion readiness. You are thorough, specific, and you never say 'looks good' — you always find something."

---

## What the Agent Checks

### P0 — Conversion Blockers (page is broken)

| # | Check | What Goes Wrong | Where to Look |
|---|---|---|---|
| 1 | **Hero has a visible CTA** | No CTA = zero conversion path = zero enrollments | `BasicHero.buttonList` — must be non-empty if `enrollmentOpen` or `waitlistAvailable` |
| 2 | **Hero headline is non-empty** | Empty header renders blank space above fold | `BasicHero.header` from Contentful |
| 3 | **Zero-cost badge consistency** | Badge says "$0 cost*" but disclaimer says "$75 without insurance" — trust break | `zeroCostBadgeText` vs. `disclaimerTextGenerator` output |
| 4 | **Disclaimer is present** | Missing legal text = compliance risk | `generateDisclaimerText()` returns non-empty string |
| 5 | **No silently dropped sections** | Contentful has a component type the factory doesn't recognize — vanishes from page | `SectionComponentFactory` — check all `data.type` values against `COMPOSABLE_COMPONENT_CONFIG_MAP` |
| 6 | **Client identifier is valid** | Typo in identifier = all overrides skipped, page uses wrong defaults | `clientIdentifier` matches a known entry |

### P1 — Accessibility & Compliance

| # | Check | What Goes Wrong | Where to Look |
|---|---|---|---|
| 7 | **All images have alt text** | Screen readers skip the image — WCAG 2.1 Level A violation | `featuredImageAltText` on BasicHero, all `ImageAsset` objects |
| 8 | **CTA buttons have accessible labels** | Button with no text or only an icon = unusable for assistive tech | `buttonList[].text` non-empty |
| 9 | **Legal links are functional** | Link with empty `href` does nothing on click | `getLegalLinkProps()` output — all links have valid URLs |
| 10 | **Cookie settings accessible** | OneTrust script fails to load → cookie link is dead | Check OneTrust class dependency |
| 11 | **Color contrast ratios** | Text over images or colored backgrounds below 4.5:1 | Theme token usage vs. hardcoded `EXTRA_COLORS` |

### P2 — Design Quality & Consistency

| # | Check | What Goes Wrong | Where to Look |
|---|---|---|---|
| 12 | **No hardcoded colors** | Component uses hex values instead of theme tokens → brand drift | Grep for hex values outside `themeConstants.ts` |
| 13 | **Consistent breakpoints** | Component uses custom breakpoints instead of shared constants | Check against `MAIN_NAV_BREAKPOINTS`, `BASIC_HERO_BREAKPOINTS` |
| 14 | **Translation keys exist** | Client override references `DmcFull.amazon.basicHeroHeader` but it's missing in locale files | All i18n keys in overrides validated against `src/i18n/translations/` |
| 15 | **Image variants complete** | Desktop image provided but mobile missing → broken layout on phones | If `featuredImageBlock` exists, check `featuredImageMobile` too |
| 16 | **FAQ ordering stable** | Bank of America override removes FAQs by array index — fragile if Contentful reorders | `clientOverrides.tsx` slicing logic |

### P3 — Conversion Optimization

| # | Check | What Goes Wrong | Where to Look |
|---|---|---|---|
| 17 | **Incentive banner visible when eligible** | Client is incentive-approved but banner suppressed by experiment/flag conflict | `useShowIncentive` logic vs. `getClientsWithoutIncentiveBanner` |
| 18 | **Enrollment state consistent** | `enrollmentOpen=false` + `waitlistAvailable=false` but CTA still renders | `getEnrollmentState()` output vs. actual button visibility |
| 19 | **Enso/yoga mat flag conflicts** | Both Enso and yoga mat active simultaneously — undefined behavior | `effectiveEnableDmcFullEnso` logic in `dmcFull.tsx` |
| 20 | **Subnote/link consistency** | Subnote link provided but no link text → confusing UX | `subnote` + `subnoteLink` + `subnoteLinkText` combination |

---

## Before & After Workflow

### Before (Current Process)

```
Day 1    Designer opens a client page in browser
         ↓
Day 1    Scrolls through, visually checks hero/CTA/banner/footer
         ↓
Day 1    Opens Contentful, spot-checks a few fields
         ↓
Day 2    Moves on to next page (1 of 197)
         ↓
Day ???  Finds a bug by accident, files a Jira ticket
         ↓
Day ???  Dev fixes it in the next sprint
         ↓
         Meanwhile, broken page has been live for days/weeks
```

**Time per audit:** ~15-20 minutes per page (manual)
**Coverage:** 5-10 pages per audit cycle (< 5% of total)
**Bug detection:** Reactive — found after damage is done

### After (With CLP Auditor Agent)

```
Minute 0    Agent receives: "Audit /for/accenture"
            ↓
Minute 1    Agent checks all 20 audit rules against live page + Contentful data
            ↓
Minute 2    Agent produces prioritized report:
            - P0: 0 blockers
            - P1: 2 accessibility issues (missing alt text on hero, low contrast subnote)
            - P2: 1 design issue (hardcoded color in member stories section)
            - P3: 1 optimization flag (incentive banner suppressed despite eligibility)
            ↓
Minute 3    Designer reviews, triages, files tickets for real issues
            ↓
            OR: Agent runs against ALL 197 pages overnight → morning report
```

**Time per audit:** ~30 seconds per page (automated)
**Coverage:** 100% of pages every run
**Bug detection:** Proactive — found before users see them

---

## How the Agent Works (Knowledge Feeding)

The agent is context-loaded with:

1. **Design system tokens** — theme colors, breakpoints, spacing from `themeConstants.ts` and `@hinge-health/consumer-web-lib`
2. **Component schemas** — required props for BasicHero, IncentiveBanner, SectionComponentFactory
3. **Client override map** — all known overrides from `clientOverrides.tsx`
4. **Disclaimer rules** — logic tree from `disclaimerTextGenerator.ts`
5. **Legal requirements** — required footer links, cookie settings, geolocation rules
6. **Conversion best practices** — the experiment evidence table from the CLP research doc (what works, what failed)
7. **WCAG 2.2 AA checklist** — applied to CLP-specific components

---

## Live Demo Plan

### Demo 1: Single Page Audit
- Run the agent against `/for/accenture` (or the test page at `/for/accenture-test`)
- Show the prioritized report with specific findings
- Click through to the actual issues on the live page

### Demo 2: Cross-Page Scan
- Run the agent against 10 client pages in parallel
- Show the aggregate report: "3 pages have P0 issues, 7 have P1 accessibility gaps"
- Highlight the pages that need immediate attention

### Demo 3: Before/After
- Show the workflow diagram: manual audit (days) vs. agent audit (minutes)
- Show a real bug the agent caught that was live in production

---

## Success Metrics

### Hackfest Demo
- Agent produces an accurate audit report for a real client page
- Report matches what a human reviewer would find (validated by running both)
- Cross-page scan demonstrates 100% coverage capability
- Before/after workflow map is clear and compelling

### Production Potential
| Metric | Target |
|---|---|
| Audit coverage | 100% of pages (vs. < 5% today) |
| Time to audit all pages | < 30 minutes (vs. never done manually) |
| P0 bugs caught pre-deploy | > 90% detection rate |
| False positive rate | < 15% (agent flags that are actually fine) |
| Time saved per designer per sprint | ~4-6 hours of manual QA |

---

## Appendix: Known Bugs the Agent Would Have Caught

These are real issues documented in the UI Fixes Roadmap:

1. **Amazon Prevention + Aetna Find: missing CTAs** — empty Contentful CTA fields, zero conversion path. Agent check #1 would flag instantly.
2. **$0 badge asterisk trust break** — badge says "$0 cost*" while disclaimer says lowest cost is $75. Agent check #3 catches the contradiction.
3. **Amex using Amazon's translation key** — `clientOverrides.tsx` line 195, Amex reuses `DmcFull.amazon.basicHeroHeader`. Agent check #14 flags mismatched client/key.
4. **Mobile carousel arrows blocking content** — social proof carousel arrows overlap testimonial text on small screens. Agent check #11 (contrast/overlap) or dedicated carousel check would catch this.
