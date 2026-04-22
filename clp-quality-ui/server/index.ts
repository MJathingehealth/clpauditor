import "dotenv/config";
import express from "express";
import cors from "cors";
import { auditPage } from "./auditor.js";
import { compareFigmaToCode } from "./figma-compare.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/audit", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  try {
    console.log(`Auditing: ${url}`);
    const result = await auditPage(url);
    res.json(result);
  } catch (err: any) {
    console.error("Audit failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/figma-compare", async (req, res) => {
  const { figmaUrl, pageUrl } = req.body;
  if (!figmaUrl || !pageUrl) {
    res.status(400).json({ error: "figmaUrl and pageUrl are both required" });
    return;
  }

  try {
    console.log(`Comparing Figma: ${figmaUrl} → Page: ${pageUrl}`);
    const result = await compareFigmaToCode(figmaUrl, pageUrl);
    res.json(result);
  } catch (err: any) {
    console.error("Figma compare failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3100;
app.listen(PORT, () => {
  console.log(`CLP Auditor API running on http://localhost:${PORT}`);
  console.log(`Figma token: ${process.env.FIGMA_ACCESS_TOKEN ? "loaded" : "MISSING — set FIGMA_ACCESS_TOKEN in .env"}`);
});
