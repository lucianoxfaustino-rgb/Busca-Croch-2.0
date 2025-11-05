// server/vision.ts
// Chama Google Vision REST (base64) e mapeia facetas úteis para a busca por imagem.

import fetch from "node-fetch";

type VisionResult = {
  labels: Array<{ description: string; score?: number }>;
  web: any;
  objects: any[];
};

function lower(s?: string) {
  return (s || "").toLowerCase();
}

export async function callVisionBase64(jpegBuffer: Buffer): Promise<VisionResult> {
  const key = process.env.VISION_API_KEY;
  if (!key) throw new Error("VISION_API_KEY not set");
  const content = jpegBuffer.toString("base64");

  const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content },
          features: [
            { type: "WEB_DETECTION", maxResults: 15 },
            { type: "LABEL_DETECTION", maxResults: 20 },
            { type: "OBJECT_LOCALIZATION", maxResults: 15 }
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Vision HTTP ${resp.status}: ${txt}`);
  }

  const j = await resp.json();
  const r = j?.responses?.[0] || {};
  return {
    labels: r.labelAnnotations || [],
    web: r.webDetection || {},
    objects: r.localizedObjectAnnotations || [],
  };
}

// Mapeamento PT <-> EN (ajusta para seu domínio)
const PT_EN: Array<[string, string[]]> = [
  ["bolsa", ["bag", "handbag", "tote", "purse", "shoulder bag", "sling bag"]],
  ["sousplat", ["placemat", "doily"]],
  ["tapete", ["rug", "mat"]],
  ["biquíni", ["bikini", "swimsuit"]],
  ["amigurumi", ["amigurumi", "crochet toy", "plush", "stuffed toy"]],
  ["blusa", ["blouse", "top", "shirt"]],
];

function guessTypeFromVision(v: VisionResult): string | null {
  const bestGuessLabels = (v.web?.bestGuessLabels || []).map((b: any) => lower(b.label || ""));
  const labelAnnotations = (v.labels || []).map((l: any) => ({
    description: lower(l.description),
    score: l.score || 0,
  }));

  const hay = [...bestGuessLabels, ...labelAnnotations.map((l) => l.description)];

  for (const [pt, ens] of PT_EN) {
    if (hay.some((h) => h.includes(pt))) return pt;
    if (hay.some((h) => ens.some((en) => h.includes(en)))) {
      const highScore = labelAnnotations.some((la) =>
        ens.some((en) => la.description.includes(en) && la.score >= 0.75)
      );
      if (highScore) return pt;
      if (bestGuessLabels.some((bg) => ens.some((en) => bg.includes(en)))) return pt;
    }
  }
  return null;
}

export function mapToTaxonomy(visionData: VisionResult) {
  const type = guessTypeFromVision(visionData); // null se não confiante
  const labelTags = (visionData.labels || [])
    .filter((l) => (l.score || 0) >= 0.6)
    .map((l) => lower(l.description));

  const stitches = labelTags.filter((t) =>
    ["braid", "cable", "shell", "mesh", "lace", "rib", "purl", "chain", "double", "single"].some((k) =>
      t.includes(k)
    )
  );

  const webEntities = (visionData.web?.webEntities || [])
    .filter((e: any) => (e.score || 0) >= 0.7 && e.description)
    .map((e: any) => lower(e.description));

  const bestGuess = lower(visionData.web?.bestGuessLabels?.[0]?.label || "");

  return {
    type: type || null,
    tags: Array.from(new Set([...labelTags, ...webEntities])),
    stitches,
    bestGuess,
    visionRaw: visionData,
  };
}
