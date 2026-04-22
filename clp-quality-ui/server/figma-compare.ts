/**
 * Figma-to-Code Visual Comparison
 *
 * No tree walking. No text matching. Pure visual comparison.
 *
 * 1. Screenshots the Figma frame via the Images API
 * 2. Screenshots the live page at matching viewport (auto-detected from Figma width)
 * 3. Slices both into horizontal sections
 * 4. Pixel-diffs each pair → highlights differences in red
 * 5. Reports similarity % per section + overall
 */

import puppeteer from "puppeteer";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN || "";

// ─── Types ───────────────────────────────────────────────

interface Annotation {
  type: "copy" | "image" | "missing-section" | "spacing" | "color" | "font" | "extra-section";
  severity: "mismatch" | "close";
  message: string;
  figmaValue?: string;
  codeValue?: string;
}

interface SectionResult {
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

interface CompareResult {
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
  sections: SectionResult[];
  annotations: Annotation[];
  score: number;
  summary: { matches: number; close: number; mismatches: number; total: number };
}

// ─── Figma API ───────────────────────────────────────────

function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  const m = url.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)\/[^?]*\?.*node-id=([0-9]+-[0-9]+)/);
  if (m) return { fileKey: m[1], nodeId: m[2].replace("-", ":") };
  return null;
}

async function figmaGet(path: string): Promise<any> {
  const res = await fetch(`https://api.figma.com/v1${path}`, { headers: { "X-Figma-Token": FIGMA_TOKEN } });
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchFigmaImageBuffer(fileKey: string, nodeId: string, scale = 2): Promise<Buffer> {
  const data = await figmaGet(`/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`);
  const url = data.images?.[nodeId];
  if (!url) throw new Error("Figma returned no image for this node");
  const res = await fetch(url as string);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Image Helpers ───────────────────────────────────────

function bufToBase64(buf: Buffer): string {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function resizeToMatch(imgBuf: Buffer, targetWidth: number, targetHeight: number): Promise<Buffer> {
  return sharp(imgBuf)
    .resize(targetWidth, targetHeight, { fit: "cover", position: "top" })
    .png()
    .toBuffer();
}

function createDiffImage(img1Buf: Buffer, img2Buf: Buffer, width: number, height: number): { diffBuf: Buffer; diffPixels: number; totalPixels: number } {
  const png1 = PNG.sync.read(img1Buf);
  const png2 = PNG.sync.read(img2Buf);
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    png1.data, png2.data, diff.data,
    width, height,
    { threshold: 0.15, alpha: 0.3, diffColor: [255, 60, 60], diffColorAlt: [255, 180, 60] },
  );

  return {
    diffBuf: PNG.sync.write(diff),
    diffPixels,
    totalPixels: width * height,
  };
}

async function sliceImage(imgBuf: Buffer, y: number, height: number, width: number): Promise<Buffer> {
  return sharp(imgBuf)
    .extract({ left: 0, top: y, width, height })
    .png()
    .toBuffer();
}

// ─── Section Detection ───────────────────────────────────
// Instead of parsing the DOM, we detect sections by finding horizontal bands
// of similar color in the Figma screenshot (section breaks are usually
// background color changes). Simple and works regardless of implementation.

async function detectSections(imgBuf: Buffer, width: number, totalHeight: number): Promise<{ y: number; height: number }[]> {
  // Sample one pixel column from the image to find color transitions
  const raw = await sharp(imgBuf)
    .resize(1, totalHeight, { fit: "fill" }) // squeeze to 1px wide
    .raw()
    .toBuffer();

  const sections: { y: number; height: number }[] = [];
  let sectionStart = 0;
  let prevR = raw[0], prevG = raw[1], prevB = raw[2];

  const minSectionHeight = Math.max(80, Math.round(totalHeight * 0.04)); // at least 4% of page or 80px

  for (let y = 1; y < totalHeight; y++) {
    const r = raw[y * 3], g = raw[y * 3 + 1], b = raw[y * 3 + 2];
    const diff = Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);

    // Color changed significantly → potential section boundary
    if (diff > 40) {
      const sectionHeight = y - sectionStart;
      if (sectionHeight >= minSectionHeight) {
        sections.push({ y: sectionStart, height: sectionHeight });
        sectionStart = y;
      }
    }
    prevR = r; prevG = g; prevB = b;
  }

  // Last section
  const lastHeight = totalHeight - sectionStart;
  if (lastHeight >= minSectionHeight) {
    sections.push({ y: sectionStart, height: lastHeight });
  }

  // If we found too few sections, split evenly
  if (sections.length < 3) {
    const chunkH = Math.round(totalHeight / Math.max(5, Math.ceil(totalHeight / 500)));
    const even: { y: number; height: number }[] = [];
    for (let y = 0; y < totalHeight; y += chunkH) {
      even.push({ y, height: Math.min(chunkH, totalHeight - y) });
    }
    return even;
  }

  return sections;
}

// ─── Main ────────────────────────────────────────────────

export async function compareFigmaToCode(figmaUrl: string, pageUrl: string): Promise<CompareResult> {
  const parsed = parseFigmaUrl(figmaUrl);
  if (!parsed) throw new Error("Invalid Figma URL — needs ?node-id=X-Y");

  // Get Figma node metadata for dimensions
  console.log("Fetching Figma node metadata...");
  const nodeData = await figmaGet(`/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}`);
  const root = nodeData.nodes?.[parsed.nodeId]?.document;
  if (!root) throw new Error("Figma node not found");

  const figmaNodeName = root.name || "Unknown";
  const figmaWidth = Math.round(root.absoluteBoundingBox?.width || 0);
  const figmaHeight = Math.round(root.absoluteBoundingBox?.height || 0);

  // Auto-detect viewport
  const viewport: "mobile" | "desktop" = figmaWidth > 800 ? "desktop" : "mobile";
  const vpWidth = viewport === "desktop" ? 1440 : 430;
  console.log(`"${figmaNodeName}" ${figmaWidth}x${figmaHeight}px → ${viewport} (${vpWidth}px)`);

  // Fetch Figma screenshot
  console.log("Fetching Figma screenshot...");
  const figmaImgRaw = await fetchFigmaImageBuffer(parsed.fileKey, parsed.nodeId, 2);

  // Get Figma image actual dimensions
  const figmaMeta = await sharp(figmaImgRaw).metadata();
  const figmaImgW = figmaMeta.width!;
  const figmaImgH = figmaMeta.height!;
  console.log(`Figma image: ${figmaImgW}x${figmaImgH}`);

  // Screenshot the live page at matching viewport — full page scroll
  console.log(`Screenshotting page at ${vpWidth}px...`);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: vpWidth, height: 900, deviceScaleFactor: 2 });
  await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const pageImgRaw = await page.screenshot({ fullPage: true, encoding: "binary" }) as Buffer;
  const pageMeta = await sharp(pageImgRaw).metadata();
  console.log(`Page image: ${pageMeta.width}x${pageMeta.height}`);

  await browser.close();

  // Resize both to same width, and crop/pad to compare equal heights
  const compareWidth = Math.min(figmaImgW, pageMeta.width!);
  const compareHeight = Math.min(figmaImgH, pageMeta.height!);
  console.log(`Comparing at ${compareWidth}x${compareHeight}`);

  const figmaResized = await resizeToMatch(figmaImgRaw, compareWidth, compareHeight);
  const pageResized = await resizeToMatch(pageImgRaw, compareWidth, compareHeight);

  // Full-page diff
  console.log("Computing full-page diff...");
  const fullDiff = createDiffImage(figmaResized, pageResized, compareWidth, compareHeight);
  const overallSimilarity = Math.round((1 - fullDiff.diffPixels / fullDiff.totalPixels) * 100);
  console.log(`Overall: ${overallSimilarity}% similar (${fullDiff.diffPixels} diff pixels)`);

  // Detect sections from the Figma screenshot
  console.log("Detecting sections...");
  const sectionBounds = await detectSections(figmaResized, compareWidth, compareHeight);
  console.log(`Found ${sectionBounds.length} sections`);

  // Per-section comparison
  const sections: SectionResult[] = [];
  for (let i = 0; i < sectionBounds.length; i++) {
    const { y, height } = sectionBounds[i];
    if (height < 20) continue;

    const figSlice = await sliceImage(figmaResized, y, height, compareWidth);
    const pageSlice = await sliceImage(pageResized, y, height, compareWidth);
    const diffResult = createDiffImage(figSlice, pageSlice, compareWidth, height);
    const similarity = Math.round((1 - diffResult.diffPixels / diffResult.totalPixels) * 100);

    sections.push({
      name: `Section ${i + 1}`,
      index: i,
      figmaScreenshot: bufToBase64(figSlice),
      pageScreenshot: bufToBase64(pageSlice),
      diffScreenshot: bufToBase64(diffResult.diffBuf),
      similarity,
      diffPixels: diffResult.diffPixels,
      totalPixels: diffResult.totalPixels,
      annotations: [],
    });
  }

  // ── SMART ANNOTATIONS ──────────────────────────────────
  // Walk Figma tree + live page to annotate WHAT is different
  console.log("Running smart annotations...");
  const globalAnnotations: Annotation[] = [];

  // Reopen browser for annotation checks
  const browser2 = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page2 = await browser2.newPage();
  await page2.setViewport({ width: vpWidth, height: 900, deviceScaleFactor: 2 });
  await page2.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // 1. TEXT COMPARISON — extract Figma text, check if same on page
  const figmaTexts: { text: string; fontSize: number; fontWeight: number; fontFamily: string; yPercent: number }[] = [];
  function walkTexts(node: any, rootHeight: number) {
    if (node.type === "TEXT" && node.characters?.trim().length > 2) {
      const y = node.absoluteBoundingBox?.y || 0;
      const rootY = root.absoluteBoundingBox?.y || 0;
      figmaTexts.push({
        text: node.characters.trim(),
        fontSize: node.style?.fontSize || 16,
        fontWeight: node.style?.fontWeight || 400,
        fontFamily: node.style?.fontFamily || "",
        yPercent: rootHeight > 0 ? (y - rootY) / rootHeight : 0,
      });
    }
    if (node.children) node.children.forEach((c: any) => walkTexts(c, rootHeight));
  }
  walkTexts(root, figmaHeight);

  // Match texts on page
  const pageTextResults = await page2.evaluate((figTexts: { text: string }[]) => {
    const results: { text: string; found: boolean; fontSize?: string; fontWeight?: string; fontFamily?: string; color?: string }[] = [];
    for (const ft of figTexts) {
      // Search for the text in the DOM
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let found = false;
      while (walker.nextNode()) {
        const content = walker.currentNode.textContent?.trim() || "";
        if (content === ft.text || (ft.text.length > 10 && content.includes(ft.text.substring(0, 30)))) {
          const el = walker.currentNode.parentElement;
          if (el) {
            const s = window.getComputedStyle(el);
            results.push({
              text: ft.text,
              found: true,
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              fontFamily: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
              color: s.color,
            });
            found = true;
            break;
          }
        }
      }
      if (!found) results.push({ text: ft.text, found: false });
    }
    return results;
  }, figmaTexts.map(t => ({ text: t.text })));

  // Compare and annotate
  for (let i = 0; i < figmaTexts.length; i++) {
    const ft = figmaTexts[i];
    const pt = pageTextResults[i];
    const sectionIdx = Math.min(Math.floor(ft.yPercent * sections.length), sections.length - 1);
    const sec = sections[sectionIdx];

    if (!pt?.found) {
      const ann: Annotation = { type: "copy", severity: "mismatch", message: `Text missing from page: "${ft.text.substring(0, 60)}"`, figmaValue: ft.text.substring(0, 80) };
      sec?.annotations.push(ann);
      globalAnnotations.push(ann);
      continue;
    }

    // Font size mismatch
    if (pt.fontSize) {
      const pagePx = parseFloat(pt.fontSize);
      if (Math.abs(ft.fontSize - pagePx) > 2) {
        const ann: Annotation = { type: "font", severity: Math.abs(ft.fontSize - pagePx) > 4 ? "mismatch" : "close", message: `Font size drift on "${ft.text.substring(0, 40)}..."`, figmaValue: `${ft.fontSize}px`, codeValue: pt.fontSize };
        sec?.annotations.push(ann);
        globalAnnotations.push(ann);
      }
    }

    // Font weight mismatch
    if (pt.fontWeight) {
      const pageW = parseInt(pt.fontWeight);
      if (Math.abs(ft.fontWeight - pageW) > 100) {
        const ann: Annotation = { type: "font", severity: "mismatch", message: `Font weight drift on "${ft.text.substring(0, 40)}..."`, figmaValue: `${ft.fontWeight}`, codeValue: pt.fontWeight };
        sec?.annotations.push(ann);
        globalAnnotations.push(ann);
      }
    }

    // Font family mismatch
    if (pt.fontFamily && ft.fontFamily) {
      const fLow = ft.fontFamily.toLowerCase();
      const cLow = pt.fontFamily.toLowerCase();
      if (!fLow.includes(cLow.split(" ")[0]) && !cLow.includes(fLow.split(" ")[0])) {
        const ann: Annotation = { type: "font", severity: "mismatch", message: `Font family mismatch on "${ft.text.substring(0, 40)}..."`, figmaValue: ft.fontFamily, codeValue: pt.fontFamily };
        sec?.annotations.push(ann);
        globalAnnotations.push(ann);
      }
    }
  }

  // 2. IMAGE COMPARISON — count images per Figma section vs page section
  const figmaImageCounts: number[] = [];
  const figmaSections = (root.children || []).filter((c: any) => {
    const box = c.absoluteBoundingBox;
    return box && box.height >= 30 && box.width >= figmaWidth * 0.3;
  });
  for (const sec of figmaSections) {
    let count = 0;
    function countImgs(n: any) {
      if (n.fills?.some((f: any) => f.type === "IMAGE")) count++;
      if (n.type === "RECTANGLE" && n.fills?.some((f: any) => f.type === "IMAGE")) count++;
      if (n.children) n.children.forEach(countImgs);
    }
    countImgs(sec);
    figmaImageCounts.push(count);
  }

  const pageImageCounts = await page2.evaluate(() => {
    // Find major sections and count images in each
    const main = document.querySelector("main") || document.body;
    const secs = main.querySelectorAll(":scope > div, :scope > section, section, [class*='Section']");
    const unique = [...secs].filter(el => !([...secs].some(p => p !== el && p.contains(el))));
    unique.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return unique.slice(0, 20).map(el => el.querySelectorAll("img").length);
  });

  // Compare image counts
  const minLen = Math.min(figmaImageCounts.length, pageImageCounts.length);
  for (let i = 0; i < minLen; i++) {
    if (figmaImageCounts[i] > 0 && pageImageCounts[i] === 0) {
      const sIdx = Math.min(Math.floor(i / figmaImageCounts.length * sections.length), sections.length - 1);
      const ann: Annotation = { type: "image", severity: "mismatch", message: `Figma section ${i + 1} has ${figmaImageCounts[i]} image(s) but page section has none`, figmaValue: `${figmaImageCounts[i]} images`, codeValue: "0 images" };
      sections[sIdx]?.annotations.push(ann);
      globalAnnotations.push(ann);
    }
  }

  // 3. SECTION COUNT — check if page has fewer sections
  if (figmaSections.length > pageImageCounts.length + 2) {
    globalAnnotations.push({
      type: "missing-section",
      severity: "mismatch",
      message: `Figma has ${figmaSections.length} sections but page only has ~${pageImageCounts.length}. Some sections may be missing in production.`,
      figmaValue: `${figmaSections.length} sections`,
      codeValue: `~${pageImageCounts.length} sections`,
    });
  }

  // 4. COLOR SAMPLING — compare dominant colors in each section slice
  for (const sec of sections) {
    if (sec.similarity >= 95) continue; // skip sections that already match

    // Sample the average color of the Figma slice vs page slice
    // (crude but effective for catching bg color diffs)
    try {
      const figStats = await sharp(Buffer.from(sec.figmaScreenshot.split(",")[1], "base64")).stats();
      const pageStats = await sharp(Buffer.from(sec.pageScreenshot.split(",")[1], "base64")).stats();

      const figAvg = figStats.channels.map(c => Math.round(c.mean));
      const pageAvg = pageStats.channels.map(c => Math.round(c.mean));
      const colorDiff = Math.abs(figAvg[0] - pageAvg[0]) + Math.abs(figAvg[1] - pageAvg[1]) + Math.abs(figAvg[2] - pageAvg[2]);

      if (colorDiff > 60) {
        sec.annotations.push({
          type: "color",
          severity: "mismatch",
          message: `Background color appears different`,
          figmaValue: `rgb(${figAvg.join(", ")})`,
          codeValue: `rgb(${pageAvg.join(", ")})`,
        });
      }
    } catch {}
  }

  await browser2.close();
  console.log(`${globalAnnotations.length} annotations generated`);

  // Sort sections: most different first
  sections.sort((a, b) => a.similarity - b.similarity);

  // Summary
  const matchSections = sections.filter(s => s.similarity >= 95).length;
  const closeSections = sections.filter(s => s.similarity >= 80 && s.similarity < 95).length;
  const mismatchSections = sections.filter(s => s.similarity < 80).length;

  return {
    figmaUrl, pageUrl,
    timestamp: new Date().toISOString(),
    figmaNodeName, figmaWidth, figmaHeight, viewport,
    figmaScreenshot: bufToBase64(figmaResized),
    pageScreenshot: bufToBase64(pageResized),
    diffScreenshot: bufToBase64(fullDiff.diffBuf),
    overallSimilarity,
    sections,
    annotations: globalAnnotations,
    score: overallSimilarity,
    summary: {
      matches: matchSections,
      close: closeSections,
      mismatches: mismatchSections,
      total: sections.length,
    },
  };
}
