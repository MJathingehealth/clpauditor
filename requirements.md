# Condition-Specific Client Landing Page (CLP)

## AI x Design Hackfest 2026 — Theme 1: "Design Without Designing"

**Author:** Murari Jha, Design Lead — Consumer Web
**Date:** April 15, 2026
**Pipeline:** Spec (this doc) → Design (Google Stitch) → Code (Claude Code) → Video Showcase

---

## Problem Statement

Today, Hinge Health's 197+ client landing pages use a **one-size-fits-all template**. A user arriving from a "back pain" Google ad sees the same page structure, testimonials, stats, and mid-page content as someone searching for knee or pelvic health help. The only thing that changes is the hero image and headline — everything below the fold is generic.

This is a missed opportunity. **80% of visitors never click the CTA.** Of those who scroll, engagement drops sharply:

| Section | Scroll Reach | CTR |
|---|---|---|
| Hero (above fold) | 100% | ~20% |
| Incentive Banner | ~82% | ~10% |
| Cost Comparison | ~60% | ~6% |
| Member Stories | ~45% | ~4% |
| Stats Module | ~32% | ~3% |
| Body Areas / Tab | ~20% | ~2% |
| Bottom (FAQ, Steps, Final CTA) | ~8% | ~2% |

The visitor came to this page because of a **specific condition**. But by the time they scroll past the hero, nothing on the page speaks to *their* pain anymore. They bounce.

---

## What Are We Solving

**The relevance gap between user intent and page content.**

A user who clicked a "back pain relief" ad should land on a page where:
- The hero speaks directly to back pain
- The testimonial is from someone who had back pain
- The stats cite back pain outcomes (e.g., "75% reduction in back pain within 12 weeks")
- The cost comparison explains coverage for MSK care specific to their area
- The imagery shows someone with their condition, not a generic fitness photo

Today, only the hero adapts. We're extending personalization to the **full page experience** based on the user's condition signal.

---

## What We Already Have (Insights & Infrastructure)

### Conversion Research
- CLP conversion rate: **34.7%** (108% to H1 2025 goal)
- Hero section drives **2x more clicks** than any other module
- Proven: **outcome-focused copy beats convenience copy** (experiment winner)
- Proven: **$0 cost visibility drives record CVR** (+44% vs OKR in Q1 2026)
- Proven: **smaller hero → CTA visible = +5% relative lift**
- Anti-pattern: hiding CTAs kills funnels (app-download-first failure: 25.3% → 15.2%)

### Existing Body Part Infrastructure
The codebase already supports 4 body-part campaign variants via UTM parameters:
- `back`, `neck`, `knee`, `mix` (+ Enso variants: `enso_back`, `enso_neck`, `enso_knee`, `enso_mix`)
- Each variant has dedicated hero images (desktop + mobile) stored in Contentful CDN
- Campaign detection via cookies (`__hh_basicHeroCampaigns_ACTIVE_QUERY_CAMPAIGN`)
- **Limitation:** Only the BasicHero component swaps — all other sections remain static

### Scroll Depth Insight
Only **8% reach the bottom** of the page. Modules below the member stories (~45% reach) contribute near-zero conversion value. A condition-specific page should be **shorter and denser** — every section earns its place by being relevant.

---

## What Will Change

### Current State (Generic CLP)
```
[Hero — condition-specific image + headline]  ← ONLY this adapts today
[Incentive Banner — generic]
[Cost Comparison — generic]
[Member Stories Carousel — generic mix of conditions]
[Stats Module — generic aggregate outcomes]
[Body Part Selector — generic]
[FAQ — generic]
[Getting Started Steps — generic]
[Final CTA — generic]
```

### Proposed State (Condition-Specific CLP)
```
[Hero — condition-specific image, headline, subhead, CTA copy]
[Trust Bar — "X members treated for [condition] this year"]
[Condition Outcome Stats — specific clinical outcomes for this condition]
[Member Story — single authentic testimonial matching condition]
[How It Works — tailored to condition treatment journey]
[Cost Section — unchanged (universal)]
[Single CTA — condition-aware copy]
```

### Key Design Principles
1. **Fewer sections, higher relevance** — 6-7 modules max (vs. current 9+)
2. **Every section acknowledges the condition** — no generic filler
3. **Social proof matches intent** — one strong testimonial > carousel of mixed stories
4. **Outcome-first copy** — lead with clinical results for their specific condition
5. **Shorter page = higher engagement density** — optimize for the 60% who reach mid-page, not the 8% at the bottom

---

## Condition Variants to Prototype

For the hackfest, we'll build **one full variant** and show the system can generate others:

| Condition | Hero Copy Direction | Key Stat | Testimonial Angle |
|---|---|---|---|
| **Back Pain** (primary build) | "Get lasting relief from back pain" | "75% report clinically significant pain reduction" | Member who avoided surgery |
| Knee Pain | "Move freely again — without knee surgery" | "68% reduction in knee surgery recommendations" | Active member returning to running/hiking |
| Neck/Shoulder | "End chronic neck pain from your phone" | "71% pain reduction in 12 weeks" | Desk worker / remote employee |
| General MSK | "Your whole body, one care team" | "2.4x more likely to complete treatment" | Multi-condition member |

---

## Success Metrics

### Hackfest Demo Metrics (what we show)
- Working interactive prototype of the back pain CLP variant
- Side-by-side comparison: generic CLP vs. condition-specific CLP
- Proof that the same pipeline generates knee/neck variants with a prompt change
- Video walkthrough of the full AI pipeline (Spec → Stitch → Code)

### Production Hypothesis (if shipped)
| Metric | Current | Target | Rationale |
|---|---|---|---|
| Hero CTR (condition campaigns) | ~20% | 25-28% | Stronger relevance match from ad → page |
| Scroll depth to mid-page | ~45% | 55-60% | Every section feels relevant, less bounce |
| Overall CLP CVR | 34.7% | 37-39% | Compounding effect of relevance across page |
| Bounce rate (condition campaigns) | ~55% | ~45% | Page matches expectation from ad creative |
| Time on page | ~45s | ~60s | More engaging, condition-matched content |

---

## Hackfest Pipeline — Step by Step

### Step 1: Spec (this document)
- [x] Problem statement with data
- [x] Insights from existing research
- [x] What changes and design principles
- [x] Success metrics

### Step 2: Design — Google Stitch
- Feed Stitch the requirements + current CLP structure
- Generate mobile-first UI for the back pain variant
- Iterate on Stitch output 2-3 times (Director's role: critique & refine)
- Export screens for reference

### Step 3: Code — Claude Code + Replit
- Build a standalone React prototype (not coupled to Gatsby build)
- Mobile-first, interactive, deployable
- Include condition-switching to demo the system (back → knee → neck)
- Animate transitions between condition variants

### Step 4: Video Showcase
- Screen-record the working prototype
- Narrate the AI pipeline story: "I wrote zero UI code and drew zero frames"
- Show the before (generic CLP) vs. after (condition-specific CLP)
- Highlight the multi-agent workflow: Spec Agent → Design Agent → Code Agent → Director (me)

---

## Appendix: AI Pipeline Roles

| Role | Tool | Job |
|---|---|---|
| **Researcher** | Glean / Claude | Synthesize CLP conversion research into actionable spec |
| **UX Architect** | Claude | Define information architecture, section order, content strategy |
| **UI Generator** | Google Stitch | Generate high-fidelity mobile screens from natural language |
| **Code Builder** | Claude Code / Replit | Produce interactive React prototype |
| **Director** | Murari (you) | Critique, refine prompts, curate best output, stitch the story |
