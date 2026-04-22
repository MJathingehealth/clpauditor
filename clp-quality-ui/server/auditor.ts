import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

// ─── Design System Tokens ────────────────────────────────

const APPROVED_HEX = new Set([
  // Grayscale
  "#000000","#1C1B1F","#373938","#484649","#676767","#848484","#A0A0A0","#BCBCBC","#D6D6D6","#DDDDDD","#EDEDED","#F9F9F9","#FFFFFF",
  // Evergreen
  "#003617","#00491F","#006730","#007B34","#00842D","#00A749","#0EBB65","#2DD081","#BDE9C9","#D9F2E4","#EAFAF1",
  // Oat
  "#FFFBED",
  // Yellow
  "#FFC600","#FFD74A","#FFE790","#FFEEB2","#FFF5D0",
  // Red
  "#EE3932","#FE5A54","#FF9490","#FAC3C1","#FFDAD9",
  // Fuchsia
  "#E55CCD","#F87FE2","#FDBEF2","#FBD5F2","#FFE8F9",
  // Sand
  "#CFB991","#E2D2B8","#EAE0D0","#F1EADE",
  // Extra
  "#00BD4F","#EAFAF1","#232E2E","#22D081","#336F69","#1A2222","#BFE9D1","#2A2A2A","#FFD7CF","#C9EEAC","#E1F7C9","#F9F8F6","#E8E6E1","#FFEEB2","#E5E5E5","#4C8C43","#1DA1F2","#EE0004",
]);

const FONT_SIZES = new Set([12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 34, 36, 40, 48, 56]);
const FONT_WEIGHTS = new Set([300, 400, 500, 600, 700, 900]);
const SPACE_SCALE = new Set([0, 4, 8, 16, 24, 32, 40, 64, 128, 256, 512]);

// ─── Types ───────────────────────────────────────────────

type Severity = "P0" | "P1" | "P2" | "P3";
type Category =
  | "cta"
  | "content"
  | "accessibility"
  | "typography"
  | "color"
  | "spacing"
  | "performance"
  | "seo"
  | "compliance";

interface Finding {
  severity: Severity;
  category: Category;
  title: string;
  message: string;
  element?: string;
  screenshot?: string;        // mobile screenshot (base64)
  screenshotDesktop?: string; // desktop screenshot (base64)
  selector?: string;
}

interface AuditResult {
  url: string;
  timestamp: string;
  loadTimeMs: number;
  fullScreenshot?: string;        // mobile full page
  fullScreenshotDesktop?: string; // desktop full page
  score: { overall: number; cta: number; accessibility: number; designSystem: number; images: number; seo: number };
  summary: { total: number; p0: number; p1: number; p2: number; p3: number; passed: number };
  findings: Finding[];
  passed: { category: Category; title: string }[];
}

// ─── Screenshot Helpers ──────────────────────────────────

async function captureElementScreenshot(
  page: puppeteer.Page,
  selector: string,
): Promise<string | undefined> {
  try {
    const el = await page.$(selector);
    if (!el) return undefined;

    const box = await el.boundingBox();
    if (!box) return undefined;

    const pad = 20;
    const clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(box.width + pad * 2, 1500),
      height: Math.min(box.height + pad * 2, 400),
    };

    const buffer = await page.screenshot({ clip, encoding: "base64" }) as string;
    return `data:image/png;base64,${buffer}`;
  } catch {
    return undefined;
  }
}

async function captureRegionScreenshot(
  page: puppeteer.Page,
  y: number,
  height: number = 300,
  vpWidth: number = 430,
): Promise<string | undefined> {
  try {
    const clip = {
      x: 0,
      y: Math.max(0, y - 20),
      width: vpWidth,
      height: Math.min(height + 40, 500),
    };
    const buffer = await page.screenshot({ clip, encoding: "base64" }) as string;
    return `data:image/png;base64,${buffer}`;
  } catch {
    return undefined;
  }
}

/**
 * Find elements on the live page by computed style and screenshot them.
 * Adds a red dashed outline around the offending element before capture.
 */
async function findAndScreenshotByComputedStyle(
  page: puppeteer.Page,
  cssProp: string,
  cssValue: string,
): Promise<{ screenshot: string; elementInfo: string } | undefined> {
  try {
    // Find the first visible element with this computed style value
    const result = await page.evaluate((prop, val) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        const computed = window.getComputedStyle(el);
        const actual = computed.getPropertyValue(prop);
        if (actual === val || actual === val + "px" || parseFloat(actual) === parseFloat(val)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.top < document.documentElement.scrollHeight) {
            const text = (el as HTMLElement).innerText?.substring(0, 80) || "";
            const tag = el.tagName.toLowerCase();
            const cls = el.className?.toString().split(" ")[0] || "";
            return { text, tag, cls };
          }
        }
      }
      return null;
    }, cssProp, cssValue);

    const handle = await page.evaluateHandle((prop, val) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        const computed = window.getComputedStyle(el);
        const actual = computed.getPropertyValue(prop);
        if (actual === val || actual === val + "px" || parseFloat(actual) === parseFloat(val)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.top < document.documentElement.scrollHeight) {
            return el;
          }
        }
      }
      return null;
    }, cssProp, cssValue);

    const el = handle.asElement();
    if (!el) return undefined;

    // Add a highlight outline
    await page.evaluate((node) => {
      (node as HTMLElement).style.outline = "3px dashed #D32F2F";
      (node as HTMLElement).style.outlineOffset = "2px";
    }, el);

    // Small delay for the outline to render
    await new Promise(r => setTimeout(r, 100));

    const box = await el.boundingBox();
    if (!box) return undefined;

    // Capture with generous padding for context
    const pad = 40;
    const clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(box.width + pad * 2, 1500),
      height: Math.min(box.height + pad * 2, 500),
    };

    const buffer = await page.screenshot({ clip, encoding: "base64" }) as string;

    // Remove the highlight
    await page.evaluate((node) => {
      (node as HTMLElement).style.outline = "";
      (node as HTMLElement).style.outlineOffset = "";
    }, el);

    const elementInfo = result ? `<${result.tag}${result.cls ? ` class="${result.cls}"` : ""}> "${result.text}"` : "";

    return { screenshot: `data:image/png;base64,${buffer}`, elementInfo };
  } catch {
    return undefined;
  }
}

/**
 * Find elements with a specific inline or computed color and screenshot them.
 */
async function findAndScreenshotByColor(
  page: puppeteer.Page,
  hexColor: string,
): Promise<string | undefined> {
  try {
    // Convert hex to rgb for comparison
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const rgbTarget = `rgb(${r}, ${g}, ${b})`;

    const handle = await page.evaluateHandle((target) => {
      const all = document.querySelectorAll("*");
      for (const el of all) {
        const s = window.getComputedStyle(el);
        if (s.color === target || s.backgroundColor === target || s.borderColor === target) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return el;
        }
      }
      return null;
    }, rgbTarget);

    const el = handle.asElement();
    if (!el) return undefined;

    await page.evaluate((node) => {
      (node as HTMLElement).style.outline = "3px dashed #D32F2F";
      (node as HTMLElement).style.outlineOffset = "2px";
    }, el);
    await new Promise(r => setTimeout(r, 100));

    const box = await el.boundingBox();
    if (!box) return undefined;

    const pad = 40;
    const clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(box.width + pad * 2, 1500),
      height: Math.min(box.height + pad * 2, 500),
    };

    const buffer = await page.screenshot({ clip, encoding: "base64" }) as string;

    await page.evaluate((node) => {
      (node as HTMLElement).style.outline = "";
      (node as HTMLElement).style.outlineOffset = "";
    }, el);

    return `data:image/png;base64,${buffer}`;
  } catch {
    return undefined;
  }
}

// ─── Live Page Checks (Puppeteer) ────────────────────────

async function runLivePageChecks(
  page: puppeteer.Page,
  vp: { name: string; width: number; height: number },
  findings: Finding[],
) {
  const vpLabel = vp.name === "mobile" ? "Mobile" : "Desktop";

  // Dedupe helper — don't add same finding title twice
  const has = (title: string) => findings.some(f => f.title === title);

  // P0: Broken hero image (largest image in first viewport)
  if (!has(`Broken hero image (${vpLabel})`)) {
    const brokenHeroImg = await page.evaluate((vpHeight) => {
      const images = document.querySelectorAll("img");
      for (const img of images) {
        const rect = img.getBoundingClientRect();
        // Image in first viewport and large enough to be a hero
        if (rect.top < vpHeight && rect.width > 100 && rect.height > 80) {
          if (!img.complete || img.naturalWidth === 0) {
            return { src: img.src?.substring(0, 80), width: rect.width, height: rect.height };
          }
        }
      }
      return null;
    }, vp.height);

    if (brokenHeroImg) {
      findings.push({
        severity: "P0",
        category: "content",
        title: `Broken hero image (${vpLabel})`,
        message: `A large image in the first viewport failed to load (${Math.round(brokenHeroImg.width)}x${Math.round(brokenHeroImg.height)}px). This is likely the hero image — users see a blank space.`,
        element: brokenHeroImg.src,
        selector: `img[src*="${(brokenHeroImg.src || "").substring(0, 40)}"]`,
      });
    }
  }

  // P0: No clickable CTA visible in first viewport
  if (!has(`No CTA visible above the fold (${vpLabel})`)) {
    const ctaAboveFold = await page.evaluate((vpHeight) => {
      const candidates = document.querySelectorAll('a, button, [role="button"]');
      const ctaKeywords = /get started|sign up|enroll|start|begin|check|eligib|assess|apply|join|try/i;
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        const text = (el as HTMLElement).innerText?.trim() || el.getAttribute("aria-label") || "";
        // Visible in first viewport, has CTA-like text, and has real size
        if (rect.top < vpHeight && rect.bottom > 0 && rect.width > 40 && rect.height > 20) {
          if (ctaKeywords.test(text)) {
            return { text: text.substring(0, 60), top: Math.round(rect.top) };
          }
        }
      }
      return null;
    }, vp.height);

    if (!ctaAboveFold) {
      findings.push({
        severity: "P0",
        category: "cta",
        title: `No CTA visible above the fold (${vpLabel})`,
        message: `No enrollment/get-started button visible in the first ${vpLabel.toLowerCase()} viewport (${vp.width}x${vp.height}). Users must scroll to find how to enroll. Hero CTR is ~20% — hiding the CTA kills conversion.`,
        selector: '[class*="hero" i], [class*="Hero"], header',
      });
    }
  }

  // P0: Content overflows viewport (horizontal scroll)
  if (!has(`Content overflows viewport (${vpLabel})`)) {
    const overflow = await page.evaluate((vpWidth) => {
      const body = document.body;
      const scrollWidth = body.scrollWidth;
      if (scrollWidth > vpWidth + 5) {
        return { scrollWidth, vpWidth };
      }
      return null;
    }, vp.width);

    if (overflow) {
      findings.push({
        severity: "P0",
        category: "content",
        title: `Content overflows viewport (${vpLabel})`,
        message: `Page content (${overflow.scrollWidth}px) is wider than the ${vpLabel.toLowerCase()} viewport (${overflow.vpWidth}px). Users see horizontal scrolling — this is a broken layout.`,
      });
    }
  }

  // P0: JavaScript console errors that might block rendering
  // (we collect these from page events — check if page has visible content)
  if (!has(`Page appears blank (${vpLabel})`)) {
    const isBlank = await page.evaluate(() => {
      const body = document.body;
      const text = body?.innerText?.trim() || "";
      return text.length < 50; // basically no content rendered
    });

    if (isBlank) {
      findings.push({
        severity: "P0",
        category: "content",
        title: `Page appears blank (${vpLabel})`,
        message: "The page rendered with almost no visible text content. JavaScript may have failed to hydrate, or there's a rendering error.",
      });
    }
  }

  // P0: Broken/missing favicon or brand logo
  if (!has("Brand logo missing from header")) {
    const hasLogo = await page.evaluate(() => {
      const header = document.querySelector('header, nav, [class*="nav" i], [class*="Nav"]');
      if (!header) return true; // no header to check
      const imgs = header.querySelectorAll("img, svg");
      if (imgs.length === 0) return false;
      // Check if at least one image loaded
      for (const img of imgs) {
        if (img.tagName === "SVG") return true;
        if ((img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0) return true;
      }
      return false;
    });

    if (!hasLogo) {
      findings.push({
        severity: "P0",
        category: "content",
        title: "Brand logo missing from header",
        message: "No visible logo image in the page header/nav. The brand logo failed to load or is missing.",
        selector: "header, nav",
      });
    }
  }

  // P2: Image aspect ratio should be 1:1, 3:2, or 3:4
  if (!has(`Non-standard image aspect ratios (${vpLabel})`)) {
    const badRatios = await page.evaluate((vpH) => {
      const ALLOWED = [
        { name: "1:1", ratio: 1 },
        { name: "3:2", ratio: 3 / 2 },
        { name: "2:3", ratio: 2 / 3 },
        { name: "3:4", ratio: 3 / 4 },
        { name: "4:3", ratio: 4 / 3 },
      ];
      const TOLERANCE = 0.08;

      const results: { src: string; width: number; height: number; actual: string; nearest: string }[] = [];
      const imgs = document.querySelectorAll("img");

      for (const img of imgs) {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w < 50 || h < 50) continue; // skip tiny icons/spacers

        const rect = img.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue; // not visible

        const ratio = w / h;
        const match = ALLOWED.find(a => Math.abs(ratio - a.ratio) < TOLERANCE);
        if (!match) {
          // Find nearest
          let nearestName = ALLOWED[0].name;
          let nearestDiff = Math.abs(ratio - ALLOWED[0].ratio);
          for (const a of ALLOWED) {
            const diff = Math.abs(ratio - a.ratio);
            if (diff < nearestDiff) { nearestDiff = diff; nearestName = a.name; }
          }

          const actualSimplified = ratio > 1
            ? `${(ratio).toFixed(2)}:1`
            : `1:${(1 / ratio).toFixed(2)}`;

          results.push({
            src: img.src?.substring(0, 80) || "",
            width: w,
            height: h,
            actual: actualSimplified,
            nearest: nearestName,
          });
        }
      }
      return results.length > 0 ? results : null;
    }, vp.height);

    if (badRatios) {
      for (const img of badRatios.slice(0, 5)) { // cap at 5 to avoid noise
        findings.push({
          severity: "P0",
          category: "content",
          title: `Non-standard image aspect ratio (${vpLabel})`,
          message: `Image (${img.width}x${img.height}) has ratio ${img.actual} — not 1:1, 3:2, or 3:4. Nearest allowed: ${img.nearest}.`,
          element: img.src,
          selector: img.src ? `img[src*="${img.src.substring(0, 40).replace(/['"]/g, "")}"]` : undefined,
        });
      }
    }
  }

  // P1: Image resolution too low for retina displays
  if (!has(`Low-resolution images (${vpLabel})`)) {
    const lowRes = await page.evaluate(() => {
      const dpr = window.devicePixelRatio || 2;
      const results: { src: string; natural: string; display: string; ratio: string }[] = [];
      const imgs = document.querySelectorAll("img");

      for (const img of imgs) {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (nw < 20 || nh < 20) continue;

        const rect = img.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) continue;

        // Image should be at least 1.5x the display size for retina
        const widthRatio = nw / rect.width;
        const heightRatio = nh / rect.height;
        const minRatio = Math.min(widthRatio, heightRatio);

        if (minRatio < 1.5 && rect.width > 80) {
          results.push({
            src: img.src?.substring(0, 80) || "",
            natural: `${nw}x${nh}`,
            display: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            ratio: `${minRatio.toFixed(1)}x`,
          });
        }
      }
      return results.length > 0 ? results : null;
    });

    if (lowRes) {
      for (const img of lowRes.slice(0, 4)) {
        findings.push({
          severity: "P0",
          category: "content",
          title: `Low-resolution image (${vpLabel})`,
          message: `Image is ${img.natural} but displayed at ${img.display} (${img.ratio} density). Needs 2x for retina — will appear blurry on modern screens.`,
          element: img.src,
          selector: img.src ? `img[src*="${img.src.substring(0, 40).replace(/['"]/g, "")}"]` : undefined,
        });
      }
    }
  }

  // P2: Oversized images (natural dimensions far exceed display size — wasted bytes)
  if (!has(`Oversized images (${vpLabel})`)) {
    const oversized = await page.evaluate(() => {
      const results: { src: string; natural: string; display: string; waste: string }[] = [];
      const imgs = document.querySelectorAll("img");

      for (const img of imgs) {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (nw < 50 || nh < 50) continue;

        const rect = img.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 20) continue;

        // If natural size is more than 3x the display size, it's wasteful
        // (we expect 2x for retina, so 3x+ is excessive)
        const widthRatio = nw / rect.width;
        const heightRatio = nh / rect.height;
        const maxRatio = Math.max(widthRatio, heightRatio);

        if (maxRatio > 3) {
          const wastedPixels = (nw * nh) - (Math.round(rect.width * 2) * Math.round(rect.height * 2));
          const wastedMB = ((wastedPixels * 3) / (1024 * 1024)).toFixed(1); // rough RGB estimate
          results.push({
            src: img.src?.substring(0, 80) || "",
            natural: `${nw}x${nh}`,
            display: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            waste: `~${wastedMB}MB wasted`,
          });
        }
      }
      return results.length > 0 ? results : null;
    });

    if (oversized) {
      for (const img of oversized.slice(0, 4)) {
        findings.push({
          severity: "P0",
          category: "performance",
          title: `Oversized image (${vpLabel})`,
          message: `Image is ${img.natural} but displayed at ${img.display}. This is 3x+ larger than needed (${img.waste}). Resize to 2x display size.`,
          element: img.src,
          selector: img.src ? `img[src*="${img.src.substring(0, 40).replace(/['"]/g, "")}"]` : undefined,
        });
      }
    }
  }

  // P2: Heavy images (file size too large)
  if (!has(`Heavy images (${vpLabel})`)) {
    const heavyImgs = await page.evaluate(() => {
      const results: { src: string; sizeKB: number; display: string }[] = [];
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

      for (const entry of entries) {
        if (!entry.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)/i)) continue;
        const sizeBytes = entry.transferSize || entry.encodedBodySize || 0;
        if (sizeBytes < 1) continue;
        const sizeKB = Math.round(sizeBytes / 1024);

        // Find matching img element for display size
        const img = document.querySelector(`img[src*="${entry.name.substring(entry.name.lastIndexOf("/") + 1, entry.name.lastIndexOf("/") + 30)}"]`) as HTMLImageElement | null;
        const displaySize = img ? `${Math.round(img.getBoundingClientRect().width)}x${Math.round(img.getBoundingClientRect().height)}` : "unknown";

        // Flag images over 200KB
        if (sizeKB > 200) {
          results.push({
            src: entry.name.substring(0, 80),
            sizeKB,
            display: displaySize,
          });
        }
      }
      return results.length > 0 ? results : null;
    });

    if (heavyImgs) {
      for (const img of heavyImgs.slice(0, 4)) {
        findings.push({
          severity: "P0",
          category: "performance",
          title: `Heavy image: ${img.sizeKB}KB (${vpLabel})`,
          message: `Image is ${img.sizeKB}KB (displayed at ${img.display}). Target < 200KB per image. Compress or use a smaller resolution.`,
          element: img.src,
          selector: img.src ? `img[src*="${img.src.substring(0, 40).replace(/['"]/g, "")}"]` : undefined,
        });
      }
    }
  }

  // P1: Blurry/pixelated images (natural size smaller than display size)
  if (!has(`Pixelated images (${vpLabel})`)) {
    const pixelated = await page.evaluate(() => {
      const results: { src: string; natural: string; display: string }[] = [];
      const imgs = document.querySelectorAll("img");

      for (const img of imgs) {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (nw < 10 || nh < 10) continue;

        const rect = img.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) continue;

        // Image is being upscaled — natural size is SMALLER than display size
        // This means the browser is stretching it → looks pixelated
        if (nw < rect.width * 0.9 || nh < rect.height * 0.9) {
          results.push({
            src: img.src?.substring(0, 80) || "",
            natural: `${nw}x${nh}`,
            display: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          });
        }
      }
      return results.length > 0 ? results : null;
    });

    if (pixelated) {
      for (const img of pixelated.slice(0, 4)) {
        findings.push({
          severity: "P0",
          category: "content",
          title: `Pixelated/upscaled image (${vpLabel})`,
          message: `Image is ${img.natural} but displayed at ${img.display} — it's being stretched beyond its natural size and will look blurry.`,
          element: img.src,
          selector: img.src ? `img[src*="${img.src.substring(0, 40).replace(/['"]/g, "")}"]` : undefined,
        });
      }
    }
  }

  // P0: Spelling mistakes in visible text
  if (!has(`Spelling mistakes (${vpLabel})`)) {
    const typos = await page.evaluate(() => {
      // Common misspellings and healthcare-specific typos
      const TYPO_MAP: Record<string, string> = {
        "recieve": "receive",
        "occured": "occurred",
        "seperate": "separate",
        "definately": "definitely",
        "accomodate": "accommodate",
        "occurance": "occurrence",
        "acheive": "achieve",
        "beleive": "believe",
        "calender": "calendar",
        "carribean": "Caribbean",
        "commited": "committed",
        "concious": "conscious",
        "consensous": "consensus",
        "embarass": "embarrass",
        "enviroment": "environment",
        "excercise": "exercise",
        "existance": "existence",
        "garauntee": "guarantee",
        "harrass": "harass",
        "immediatly": "immediately",
        "independant": "independent",
        "knowlege": "knowledge",
        "maintainance": "maintenance",
        "millenial": "millennial",
        "neccessary": "necessary",
        "noticable": "noticeable",
        "occurence": "occurrence",
        "persue": "pursue",
        "posession": "possession",
        "proffesional": "professional",
        "recomend": "recommend",
        "referal": "referral",
        "refferal": "referral",
        "relevent": "relevant",
        "succesful": "successful",
        "sucess": "success",
        "tommorrow": "tomorrow",
        "untill": "until",
        "wierd": "weird",
        // Healthcare-specific
        "muskuloskeletal": "musculoskeletal",
        "muculoskeletal": "musculoskeletal",
        "physiotherapy": "physical therapy", // not a typo but US vs UK
        "therepy": "therapy",
        "theraphy": "therapy",
        "symtoms": "symptoms",
        "symptons": "symptoms",
        "diagnosys": "diagnosis",
        "perscription": "prescription",
        "percription": "prescription",
        "orthopaedic": "orthopedic", // UK vs US
        "cancelation": "cancellation",
        "enrolement": "enrollment",
        "enrollement": "enrollment",
        "eligiblity": "eligibility",
        "eligibilty": "eligibility",
        "benifit": "benefit",
        "benifits": "benefits",
        "insurence": "insurance",
        "copayment": "copay", // not wrong but inconsistent
      };

      const bodyText = document.body.innerText || "";
      const words = bodyText.toLowerCase().split(/\s+/);
      const found: { typo: string; correction: string; context: string }[] = [];
      const seen = new Set<string>();

      for (const word of words) {
        const clean = word.replace(/[^a-z]/g, "");
        if (clean.length < 4) continue;
        if (TYPO_MAP[clean] && !seen.has(clean)) {
          seen.add(clean);
          // Find context around the typo
          const idx = bodyText.toLowerCase().indexOf(clean);
          const contextStart = Math.max(0, idx - 30);
          const contextEnd = Math.min(bodyText.length, idx + clean.length + 30);
          const context = bodyText.substring(contextStart, contextEnd).replace(/\n/g, " ").trim();
          found.push({ typo: clean, correction: TYPO_MAP[clean], context });
        }
      }
      return found.length > 0 ? found : null;
    });

    if (typos) {
      for (const t of typos.slice(0, 6)) {
        findings.push({
          severity: "P0",
          category: "content",
          title: `Spelling: "${t.typo}" → "${t.correction}"`,
          message: `Found "${t.typo}" on the page — should be "${t.correction}". Context: "...${t.context}..."`,
        });
      }
    }
  }

  // P1: Disclaimer visible if $0 cost is claimed
  if (!has("$0 cost claim without visible disclaimer")) {
    const zeroCostIssue = await page.evaluate(() => {
      const bodyText = document.body.innerText || "";
      const hasZeroCost = /\$0|\bcost\b.*\bfree\b|\bno cost\b|\bzero cost\b/i.test(bodyText);
      if (!hasZeroCost) return null;
      const hasDisclaimer = document.querySelector('[class*="disclaimer" i], [class*="Disclaimer"], [class*="legal" i]');
      const hasAsterisk = /\*/.test(bodyText.substring(0, 2000)); // asterisk near the claim
      if (!hasDisclaimer && !hasAsterisk) {
        return true;
      }
      return null;
    });

    if (zeroCostIssue) {
      findings.push({
        severity: "P1",
        category: "compliance",
        title: "$0 cost claim without visible disclaimer",
        message: "Page claims $0 cost but no disclaimer or asterisk is visible. This creates a trust break — the asterisk implies hidden costs.",
      });
    }
  }

  // P1: Touch targets too small (mobile only)
  if (vp.name === "mobile" && !has("Touch targets too small")) {
    const smallTargets = await page.evaluate(() => {
      const interactive = document.querySelectorAll('a, button, [role="button"], input, select');
      let tooSmall = 0;
      let example = "";
      for (const el of interactive) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.width < 44 && rect.height < 44) {
          if (rect.top > 0 && rect.top < 3000) { // visible area
            tooSmall++;
            if (!example) example = (el as HTMLElement).innerText?.substring(0, 40) || el.tagName;
          }
        }
      }
      return tooSmall > 3 ? { count: tooSmall, example } : null;
    });

    if (smallTargets) {
      findings.push({
        severity: "P1",
        category: "accessibility",
        title: "Touch targets too small",
        message: `${smallTargets.count} interactive elements are smaller than 44x44px (WCAG minimum). Example: "${smallTargets.example}". Hard to tap on mobile.`,
      });
    }
  }
}

// ─── Main Auditor ────────────────────────────────────────

export async function auditPage(url: string): Promise<AuditResult> {
  const start = Date.now();

  // Fetch HTML with cheerio for fast structural checks
  const res = await fetch(url, {
    headers: { "User-Agent": "CLP-Auditor/1.0 (Hackfest)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const findings: Finding[] = [];
  const passed: { category: Category; title: string }[] = [];

  // Run structural checks (cheerio — fast)
  checkCTAs($, findings, passed);
  checkHeroContent($, findings, passed);
  checkAccessibility($, findings, passed);
  checkTypography($, html, findings, passed);
  checkColors($, html, findings, passed);
  checkSpacing(html, findings, passed);
  checkImages($, findings, passed);
  checkSEO($, findings, passed);
  checkPerformance($, html, 0, findings, passed);
  checkCompliance($, findings, passed);
  checkHeadingHierarchy($, findings, passed);
  checkLinks($, findings, passed);

  const loadTimeMs = Date.now() - start;

  // Launch Puppeteer for screenshots — both mobile and desktop
  let fullScreenshot: string | undefined;
  let fullScreenshotDesktop: string | undefined;

  const VIEWPORTS = [
    { name: "mobile" as const, width: 430, height: 932 },
    { name: "desktop" as const, width: 1440, height: 900 },
  ];

  try {
    console.log("Launching browser for screenshots...");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    for (const vp of VIEWPORTS) {
      const isMobile = vp.name === "mobile";
      const ssKey = isMobile ? "screenshot" : "screenshotDesktop";

      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));

      console.log(`  Capturing ${vp.name} (${vp.width}px)...`);

      // ── Live page P0 checks (run in browser) ──
      await runLivePageChecks(page, vp, findings);

      // Full page screenshot
      const fullBuf = await page.screenshot({ fullPage: true, encoding: "base64" }) as string;
      const fullDataUrl = `data:image/png;base64,${fullBuf}`;
      if (isMobile) fullScreenshot = fullDataUrl;
      else fullScreenshotDesktop = fullDataUrl;

      // Element screenshots for findings with selectors
      for (const finding of findings) {
        if ((finding as any)[ssKey]) continue;
        if (finding.selector) {
          const shot = await captureElementScreenshot(page, finding.selector);
          if (shot) (finding as any)[ssKey] = shot;
        }
      }

      // Hero area for CTA/content findings
      const heroSelector = '[class*="hero" i], [class*="Hero"], [id*="hero" i], header, [class*="banner" i]:first-of-type';
      const heroShot = await captureElementScreenshot(page, heroSelector);
      for (const f of findings) {
        if ((f as any)[ssKey]) continue;
        if (f.category === "cta" || f.category === "content") {
          (f as any)[ssKey] = heroShot;
        }
      }

      // Image findings
      for (const f of findings) {
        if ((f as any)[ssKey]) continue;
        if (f.title === "Image missing alt attribute" && f.element) {
          const imgSel = `img[src*="${f.element.substring(0, 40).replace(/['"]/g, "")}"]`;
          (f as any)[ssKey] = await captureElementScreenshot(page, imgSel);
        }
      }

      // Heading findings
      for (const f of findings) {
        if ((f as any)[ssKey]) continue;
        if (f.title.includes("Heading level skipped") || f.title.includes("H1")) {
          (f as any)[ssKey] = await captureElementScreenshot(page, "h1");
        }
      }

      // Footer/compliance
      const footerSel = 'footer, [class*="footer" i], [class*="Footer"]';
      const footerShot = await captureElementScreenshot(page, footerSel);
      for (const f of findings) {
        if ((f as any)[ssKey]) continue;
        if (f.category === "compliance") (f as any)[ssKey] = footerShot;
      }

      // Top of page for SEO/perf
      const topShot = await captureRegionScreenshot(page, 0, 200, vp.width);
      for (const f of findings) {
        if ((f as any)[ssKey]) continue;
        if (f.category === "seo" || f.category === "performance") (f as any)[ssKey] = topShot;
      }

      // Typography findings — find the actual element with that computed font-size
      for (const f of findings) {
        if ((f as any)[ssKey]) continue;
        if (f.category === "typography" && f.title.startsWith("Off-scale font size:")) {
          const sizeMatch = f.title.match(/([\d.]+)px/);
          if (sizeMatch) {
            const result = await findAndScreenshotByComputedStyle(page, "font-size", sizeMatch[1]);
            if (result) {
              (f as any)[ssKey] = result.screenshot;
              if (result.elementInfo) f.element = result.elementInfo;
            }
          }
        }
        if (f.category === "typography" && f.title.includes("font weight")) {
          const result = await findAndScreenshotByComputedStyle(page, "font-weight", "bold");
          if (result) {
            (f as any)[ssKey] = result.screenshot;
            if (result.elementInfo) f.element = result.elementInfo;
          }
        }
      }

      // Color findings — find element using that color
      for (const f of findings) {
        if ((f as any)[ssKey]) continue;
        if (f.category === "color" && f.title.startsWith("Off-palette color:")) {
          const hexMatch = f.title.match(/#[0-9a-fA-F]{3,6}/);
          if (hexMatch) {
            let hex = hexMatch[0];
            if (hex.length === 4) {
              hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
            }
            (f as any)[ssKey] = await findAndScreenshotByColor(page, hex);
          }
        }
      }

      // Spacing findings — find element with that computed padding/margin
      for (const f of findings) {
        if ((f as any)[ssKey]) continue;
        if (f.category === "spacing" && f.title.startsWith("Off-scale spacing:")) {
          const pxMatch = f.title.match(/(\d+)px/);
          if (pxMatch) {
            let result = await findAndScreenshotByComputedStyle(page, "padding-top", pxMatch[1]);
            if (!result) result = await findAndScreenshotByComputedStyle(page, "padding-left", pxMatch[1]);
            if (!result) result = await findAndScreenshotByComputedStyle(page, "margin-top", pxMatch[1]);
            if (result) {
              (f as any)[ssKey] = result.screenshot;
              if (result.elementInfo) f.element = result.elementInfo;
            }
          }
        }
      }
    }

    await browser.close();
    console.log("Screenshots captured (mobile + desktop).");
  } catch (err: any) {
    console.error("Screenshot capture failed:", err.message);
  }

  // Calculate scores
  const byCat = (cat: Category) => findings.filter(f => f.category === cat);
  const penalty = (f: Finding) => f.severity === "P0" ? 8 : f.severity === "P1" ? 5 : f.severity === "P2" ? 3 : 1;
  const scoreFrom = (list: Finding[]) => Math.max(0, Math.round(100 - list.reduce((sum, f) => sum + penalty(f), 0)));

  const ctaScore = scoreFrom(byCat("cta").concat(byCat("content").filter(f => f.title.includes("H1") || f.title.includes("blank") || f.title.includes("Spelling"))));
  const a11yScore = scoreFrom(byCat("accessibility"));
  const dsScore = scoreFrom([...byCat("typography"), ...byCat("color"), ...byCat("spacing")]);
  const imgFindings = findings.filter(f =>
    f.title.includes("aspect ratio") ||
    f.title.includes("Low-resolution") ||
    f.title.includes("Oversized image") ||
    f.title.includes("Heavy image") ||
    f.title.includes("Pixelated") ||
    f.title.includes("hero image") ||
    f.title.includes("lazy") ||
    (f.category === "accessibility" && f.title.includes("Image"))
  );
  const imagesScore = scoreFrom(imgFindings);
  const seoScore = scoreFrom(byCat("seo"));
  const overall = Math.round((ctaScore + a11yScore + dsScore + imagesScore + seoScore) / 5);

  return {
    url,
    timestamp: new Date().toISOString(),
    loadTimeMs,
    fullScreenshot,
    fullScreenshotDesktop,
    score: { overall, cta: ctaScore, accessibility: a11yScore, designSystem: dsScore, images: imagesScore, seo: seoScore },
    summary: {
      total: findings.length,
      p0: findings.filter(f => f.severity === "P0").length,
      p1: findings.filter(f => f.severity === "P1").length,
      p2: findings.filter(f => f.severity === "P2").length,
      p3: findings.filter(f => f.severity === "P3").length,
      passed: passed.length,
    },
    findings,
    passed,
  };
}

// ─── CTA Checks ──────────────────────────────────────────

function checkCTAs($: cheerio.CheerioAPI, findings: Finding[], passed: { category: Category; title: string }[]) {
  const buttons = $('a[href*="enroll"], a[href*="signup"], a[href*="get-started"], a[href*="assessment"], button, [role="button"], a.btn, a[class*="cta"], a[class*="Cta"], a[class*="button"], a[class*="Button"]');
  if (buttons.length === 0) {
    findings.push({
      severity: "P0",
      category: "cta",
      title: "No CTA found",
      message: "Page has no visible call-to-action button or enrollment link. Users have no way to convert.",
    });
  } else {
    passed.push({ category: "cta", title: "CTA buttons present" });
  }

  const heroSection = $('[class*="hero"], [class*="Hero"], [id*="hero"], header, [class*="banner"], [class*="Banner"]').first();
  if (heroSection.length > 0) {
    const heroCta = heroSection.find('a, button, [role="button"]');
    if (heroCta.length === 0) {
      findings.push({
        severity: "P1",
        category: "cta",
        title: "No CTA in hero section",
        message: "The hero/banner section has no clickable CTA. The hero drives ~20% CTR — it needs a visible action.",
        selector: '[class*="hero" i], [class*="Hero"], header',
      });
    } else {
      passed.push({ category: "cta", title: "Hero section has CTA" });
    }
  }

  $("button, [role='button']").each((i, el) => {
    if (i > 5) return; // limit to first 6 to avoid noise
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr("aria-label");
    if (!text && !ariaLabel) {
      const classes = $(el).attr("class") || "";
      findings.push({
        severity: "P1",
        category: "cta",
        title: "Button with no label",
        message: "A button element has no visible text and no aria-label.",
        element: $.html(el)?.substring(0, 120),
        selector: classes ? `button.${classes.split(" ")[0]}` : undefined,
      });
    }
  });
}

// ─── Hero Content ────────────────────────────────────────

function checkHeroContent($: cheerio.CheerioAPI, findings: Finding[], passed: { category: Category; title: string }[]) {
  const h1 = $("h1");
  if (h1.length === 0) {
    findings.push({
      severity: "P1",
      category: "content",
      title: "No H1 heading",
      message: "Page is missing an H1 heading. This hurts SEO and screen reader navigation.",
    });
  } else if (h1.text().trim().length === 0) {
    findings.push({
      severity: "P0",
      category: "content",
      title: "Empty H1 heading",
      message: "H1 element exists but has no text content. This renders blank space above the fold.",
      selector: "h1",
    });
  } else {
    passed.push({ category: "content", title: "H1 heading present and non-empty" });
  }
}

// ─── Accessibility ───────────────────────────────────────

function checkAccessibility($: cheerio.CheerioAPI, findings: Finding[], passed: { category: Category; title: string }[]) {
  const lang = $("html").attr("lang");
  if (!lang) {
    findings.push({
      severity: "P1",
      category: "accessibility",
      title: "Missing lang attribute",
      message: 'The <html> element has no lang attribute. Add lang="en" for screen readers.',
    });
  } else {
    passed.push({ category: "accessibility", title: "Language attribute set" });
  }

  const skipLink = $('a[href="#main"], a[href="#content"], a[class*="skip"]');
  if (skipLink.length === 0) {
    findings.push({
      severity: "P2",
      category: "accessibility",
      title: "No skip navigation link",
      message: "No skip-to-content link found. Keyboard users must tab through the entire nav to reach content.",
      selector: "nav, header",
    });
  } else {
    passed.push({ category: "accessibility", title: "Skip navigation link present" });
  }

  const main = $("main, [role='main']");
  if (main.length === 0) {
    findings.push({
      severity: "P2",
      category: "accessibility",
      title: "No main landmark",
      message: "No <main> element or role='main' found. Screen readers use this to jump to primary content.",
    });
  } else {
    passed.push({ category: "accessibility", title: "Main landmark present" });
  }

  $("div[onclick], span[onclick]").each((i, el) => {
    if (i > 3) return;
    const role = $(el).attr("role");
    if (!role) {
      findings.push({
        severity: "P2",
        category: "accessibility",
        title: "Click handler on non-interactive element",
        message: "A <div> or <span> has an onclick handler but no ARIA role. Add role='button' and tabindex.",
        element: $(el).prop("tagName")?.toLowerCase(),
      });
    }
  });
}

// ─── Typography ──────────────────────────────────────────

function checkTypography($: cheerio.CheerioAPI, html: string, findings: Finding[], passed: { category: Category; title: string }[]) {
  const fontSizeMatches = html.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi) || [];
  let offScaleCount = 0;
  const seenOffScale = new Set<number>();

  for (const match of fontSizeMatches) {
    const size = parseFloat(match.replace(/font-size\s*:\s*/i, ""));
    if (!FONT_SIZES.has(size) && !seenOffScale.has(size)) {
      seenOffScale.add(size);
      offScaleCount++;
      const nearest = [...FONT_SIZES].reduce((a, b) => Math.abs(b - size) < Math.abs(a - size) ? b : a);
      findings.push({
        severity: "P0",
        category: "typography",
        title: `Off-scale font size: ${size}px`,
        message: `Found font-size: ${size}px which is not in the type scale. Nearest token: ${nearest}px.`,
      });
    }
  }

  if (offScaleCount === 0 && fontSizeMatches.length > 0) {
    passed.push({ category: "typography", title: "All inline font sizes use token scale" });
  }

  const weightKeywords = html.match(/font-weight\s*:\s*(bold|bolder|lighter)\b/gi) || [];
  if (weightKeywords.length > 0) {
    findings.push({
      severity: "P0",
      category: "typography",
      title: `Font weight keywords used (${weightKeywords.length}x)`,
      message: "Use numeric font weights (300, 400, 500, 600, 700, 900) instead of keywords like 'bold'.",
    });
  }

  const fontFamilies = html.match(/font-family\s*:\s*([^;}"]+)/gi) || [];
  for (const match of fontFamilies) {
    const family = match.replace(/font-family\s*:\s*/i, "").trim();
    if (!/BrownLL|inherit|sans-serif|-apple-system|system-ui|Segoe/i.test(family)) {
      findings.push({
        severity: "P0",
        category: "typography",
        title: "Non-standard font family",
        message: `Found font-family: ${family.substring(0, 60)}. Expected BrownLLWeb or system fallbacks.`,
      });
    }
  }
}

// ─── Colors ──────────────────────────────────────────────

function checkColors($: cheerio.CheerioAPI, html: string, findings: Finding[], passed: { category: Category; title: string }[]) {
  const styleAttrs: string[] = [];
  $("[style]").each((_, el) => {
    styleAttrs.push($(el).attr("style") || "");
  });
  const allStyles = styleAttrs.join(" ");

  const hexMatches = allStyles.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
  const offPalette = new Set<string>();

  for (const hex of hexMatches) {
    let normalized = hex.toUpperCase();
    if (/^#[0-9A-F]{3}$/i.test(normalized)) {
      normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    }
    if (!APPROVED_HEX.has(normalized) && !offPalette.has(normalized)) {
      offPalette.add(normalized);
      findings.push({
        severity: "P0",
        category: "color",
        title: `Off-palette color: ${hex}`,
        message: `Inline style uses ${hex} which is not in the approved Hinge Health color palette.`,
      });
    }
  }

  if (offPalette.size === 0 && hexMatches.length > 0) {
    passed.push({ category: "color", title: "All inline colors use approved palette" });
  }
}

// ─── Spacing ─────────────────────────────────────────────

function checkSpacing(html: string, findings: Finding[], passed: { category: Category; title: string }[]) {
  const spacingMatches = html.match(/(?:padding|margin|gap)(?:-(?:top|right|bottom|left))?\s*:\s*(\d+)px/gi) || [];
  const offScale = new Set<number>();

  for (const match of spacingMatches) {
    const px = parseInt(match.match(/(\d+)px/)?.[1] || "0");
    if (px > 0 && !SPACE_SCALE.has(px) && !offScale.has(px)) {
      offScale.add(px);
      const nearest = [...SPACE_SCALE].reduce((a, b) => Math.abs(b - px) < Math.abs(a - px) ? b : a);
      findings.push({
        severity: "P0",
        category: "spacing",
        title: `Off-scale spacing: ${px}px`,
        message: `Found ${px}px spacing value not in SPACE scale [0, 4, 8, 16, 24, 32, 40, 64...]. Nearest: ${nearest}px.`,
      });
    }
  }

  if (offScale.size === 0 && spacingMatches.length > 0) {
    passed.push({ category: "spacing", title: "All inline spacing uses SPACE scale" });
  }
}

// ─── Images ──────────────────────────────────────────────

function checkImages($: cheerio.CheerioAPI, findings: Finding[], passed: { category: Category; title: string }[]) {
  let missingAlt = 0;
  let totalImages = 0;

  $("img").each((i, el) => {
    if (i > 20) return; // cap to avoid huge reports
    totalImages++;
    const alt = $(el).attr("alt");
    const src = $(el).attr("src") || $(el).attr("data-src") || "";

    if (alt === undefined || alt === null) {
      missingAlt++;
      findings.push({
        severity: "P1",
        category: "accessibility",
        title: "Image missing alt attribute",
        message: "An <img> element has no alt attribute. All images must have alt text (or alt=\"\" if decorative).",
        element: src.substring(0, 80),
        selector: src ? `img[src*="${src.substring(0, 40).replace(/["']/g, "")}"]` : undefined,
      });
    }
  });

  const lazyImages = $("img[loading='lazy']");
  if (totalImages > 3 && lazyImages.length === 0) {
    findings.push({
      severity: "P3",
      category: "performance",
      title: "No lazy-loaded images",
      message: `${totalImages} images found but none use loading="lazy". Below-fold images should lazy load.`,
    });
  }

  if (missingAlt === 0 && totalImages > 0) {
    passed.push({ category: "accessibility", title: `All ${totalImages} images have alt attributes` });
  }
}

// ─── SEO ─────────────────────────────────────────────────

function checkSEO($: cheerio.CheerioAPI, findings: Finding[], passed: { category: Category; title: string }[]) {
  const title = $("title").text().trim();
  if (!title) {
    findings.push({ severity: "P1", category: "seo", title: "Missing page title", message: "No <title> tag found." });
  } else if (title.length > 60) {
    findings.push({ severity: "P3", category: "seo", title: "Title too long", message: `Title is ${title.length} chars (recommended < 60).` });
  } else {
    passed.push({ category: "seo", title: "Page title present" });
  }

  const metaDesc = $('meta[name="description"]').attr("content");
  if (!metaDesc) {
    findings.push({ severity: "P2", category: "seo", title: "Missing meta description", message: "No meta description tag. This affects search result appearance." });
  } else {
    passed.push({ category: "seo", title: "Meta description present" });
  }

  const canonical = $('link[rel="canonical"]');
  if (canonical.length === 0) {
    findings.push({ severity: "P2", category: "seo", title: "Missing canonical URL", message: "No canonical link tag. Duplicate content risk." });
  } else {
    passed.push({ category: "seo", title: "Canonical URL set" });
  }

  const ogTitle = $('meta[property="og:title"]');
  if (ogTitle.length === 0) {
    findings.push({ severity: "P3", category: "seo", title: "Missing Open Graph tags", message: "No og:title meta tag. Social sharing will lack context." });
  } else {
    passed.push({ category: "seo", title: "Open Graph tags present" });
  }
}

// ─── Performance ─────────────────────────────────────────

function checkPerformance($: cheerio.CheerioAPI, html: string, loadTimeMs: number, findings: Finding[], passed: { category: Category; title: string }[]) {
  const sizeKB = Math.round(html.length / 1024);
  if (sizeKB > 500) {
    findings.push({
      severity: "P2",
      category: "performance",
      title: `Large HTML payload: ${sizeKB}KB`,
      message: `HTML is ${sizeKB}KB. Pages over 500KB load slowly on slow networks (15% of CLP traffic). Target < 300KB.`,
    });
  } else {
    passed.push({ category: "performance", title: `HTML size OK (${sizeKB}KB)` });
  }

  const inlineScripts = $("script:not([src])").length;
  if (inlineScripts > 15) {
    findings.push({
      severity: "P3",
      category: "performance",
      title: `${inlineScripts} inline scripts`,
      message: "High number of inline scripts. Consider deferring or bundling.",
    });
  }
}

// ─── Compliance ──────────────────────────────────────────

function checkCompliance($: cheerio.CheerioAPI, findings: Finding[], passed: { category: Category; title: string }[]) {
  const oneTrust = $('script[src*="onetrust"], script[src*="cookielaw"], [class*="onetrust"]');
  if (oneTrust.length === 0) {
    findings.push({
      severity: "P2",
      category: "compliance",
      title: "No cookie consent detected",
      message: "No OneTrust or cookie consent script found. May be loaded dynamically.",
      selector: "footer",
    });
  } else {
    passed.push({ category: "compliance", title: "Cookie consent script present" });
  }

  const privacyLink = $('a[href*="privacy"]');
  if (privacyLink.length === 0) {
    findings.push({
      severity: "P1",
      category: "compliance",
      title: "No privacy policy link",
      message: "No link to a privacy policy found on the page.",
      selector: 'footer, [class*="footer" i]',
    });
  } else {
    passed.push({ category: "compliance", title: "Privacy policy link present" });
  }

  const termsLink = $('a[href*="terms"]');
  if (termsLink.length === 0) {
    findings.push({
      severity: "P2",
      category: "compliance",
      title: "No terms of service link",
      message: "No link to terms of service found on the page.",
      selector: 'footer, [class*="footer" i]',
    });
  } else {
    passed.push({ category: "compliance", title: "Terms of service link present" });
  }
}

// ─── Heading Hierarchy ───────────────────────────────────

function checkHeadingHierarchy($: cheerio.CheerioAPI, findings: Finding[], passed: { category: Category; title: string }[]) {
  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = $(el).prop("tagName")?.toLowerCase() || "";
    const level = parseInt(tag.replace("h", ""));
    headings.push({ level, text: $(el).text().trim().substring(0, 50) });
  });

  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      findings.push({
        severity: "P2",
        category: "accessibility",
        title: "Heading level skipped",
        message: `H${headings[i - 1].level} ("${headings[i - 1].text}") jumps to H${headings[i].level} ("${headings[i].text}"). Don't skip heading levels.`,
        selector: `h${headings[i].level}`,
      });
    }
  }

  const h1Count = headings.filter(h => h.level === 1).length;
  if (h1Count > 1) {
    findings.push({
      severity: "P2",
      category: "accessibility",
      title: `${h1Count} H1 elements`,
      message: "Page has multiple H1 headings. Use exactly one H1 for the main page heading.",
      selector: "h1",
    });
  }

  if (headings.length > 0 && h1Count === 1) {
    passed.push({ category: "accessibility", title: "Heading hierarchy is valid" });
  }
}

// ─── Links ───────────────────────────────────────────────

function checkLinks($: cheerio.CheerioAPI, findings: Finding[], passed: { category: Category; title: string }[]) {
  let emptyLinks = 0;
  $("a").each((i, el) => {
    if (i > 30) return;
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr("aria-label");

    if (!href || href === "#" || href === "") {
      emptyLinks++;
    }

    if (!text && !ariaLabel && !$(el).find("img").length) {
      findings.push({
        severity: "P2",
        category: "accessibility",
        title: "Link with no accessible text",
        message: "A link has no text content, no aria-label, and no image. Screen readers can't describe it.",
        element: (href || "").substring(0, 80),
      });
    }
  });

  if (emptyLinks > 3) {
    findings.push({
      severity: "P2",
      category: "accessibility",
      title: `${emptyLinks} links with empty/hash href`,
      message: "Multiple links point to '#' or have empty href. These do nothing when clicked.",
    });
  }
}
