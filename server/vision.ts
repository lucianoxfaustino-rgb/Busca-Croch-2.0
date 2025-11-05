// server/vision.ts
// Recriado do zero para Busca-Croch-2.0
//
// Funcionalidades:
// - Extrai miniaturas de YouTube / Vimeo
// - Busca og:image de páginas HTML (receitas/páginas)
// - Gera miniatura de PDF (renderizando a 1ª página com puppeteer)
// - Salva miniaturas localmente (pasta PUBLIC_THUMBS) ou em S3 (opcional)
// - Exporta funções utilitárias para usar em routes (upload/search)
//
// Dependências (instalar):
// npm i node-fetch puppeteer sharp aws-sdk uuid
// ou
// pnpm add node-fetch puppeteer sharp aws-sdk uuid
//
// Observações:
// - puppeteer baixa/usa Chromium; em ambientes serverless (Vercel) pode precisar de ajustes.
// - Se for usar S3, configure env: S3_BUCKET, S3_REGION, S3_KEY, S3_SECRET
// - Para desenvolvimento local, configure PUBLIC_THUMBS (default: ./public/thumbnails)
//

import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import puppeteer from "puppeteer";
import { URL } from "url";
import { S3 } from "aws-sdk";

type ItemType = "video" | "pdf" | "page" | "other";

const PUBLIC_THUMBS = process.env.PUBLIC_THUMBS || path.join(process.cwd(), "public", "thumbnails");
const USE_S3 = !!process.env.S3_BUCKET;
const S3_BUCKET = process.env.S3_BUCKET || "";
const S3_REGION = process.env.S3_REGION || "";
const S3_KEY = process.env.S3_KEY || "";
const S3_SECRET = process.env.S3_SECRET || "";

async function ensureThumbDir() {
  try {
    await fs.mkdir(PUBLIC_THUMBS, { recursive: true });
  } catch (err) {
    // ignore
  }
}

async function saveBufferToLocal(buffer: Buffer, filename: string) {
  await ensureThumbDir();
  const fullPath = path.join(PUBLIC_THUMBS, filename);
  await fs.writeFile(fullPath, buffer);
  // Return a public path usable by front-end (assuming /public is served at '/')
  const publicUrl = `/thumbnails/${filename}`;
  return { url: publicUrl, path: fullPath };
}

async function saveBufferToS3(buffer: Buffer, filename: string) {
  const s3 = new S3({
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_KEY,
      secretAccessKey: S3_SECRET,
    },
  });
  const Key = filename;
  await s3
    .putObject({
      Bucket: S3_BUCKET,
      Key,
      Body: buffer,
      ContentType: "image/png",
      ACL: "public-read",
    })
    .promise();
  // Construct public URL (may differ if using CloudFront/custom domain)
  return { url: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${Key}`, path: Key };
}

async function saveBuffer(buffer: Buffer, filename: string) {
  if (USE_S3) {
    return saveBufferToS3(buffer, filename);
  } else {
    return saveBufferToLocal(buffer, filename);
  }
}

/* --------------------------
   Helpers: extract video thumbnail
   -------------------------- */
export function youtubeThumbnail(url: string): string | null {
  try {
    // examples:
    // https://www.youtube.com/watch?v=VIDEOID
    // https://youtu.be/VIDEOID
    // https://www.youtube.com/embed/VIDEOID
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes("youtu")) {
      if (u.hostname === "youtu.be") {
        id = u.pathname.slice(1);
      } else {
        id = u.searchParams.get("v");
        if (!id) {
          // maybe /embed/VIDEO
          const m = u.pathname.match(/\/embed\/([^\/\?]+)/);
          if (m) id = m[1];
        }
      }
    }
    if (id) {
      // high quality default thumbnail
      return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }
    return null;
  } catch (err) {
    return null;
  }
}

export function vimeoThumbnail(url: string): string | null {
  // Vimeo doesn't allow pattern-based thumb URLs; need oEmbed or API.
  // We'll return null here and later try oEmbed.
  return null;
}

/* --------------------------
   Helper: fetch oEmbed for video (YouTube/Vimeo)
   -------------------------- */
async function fetchOEmbedThumbnail(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.hostname.includes("vimeo.com")) {
      // Vimeo oEmbed
      const api = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
      const res = await fetch(api);
      if (!res.ok) return null;
      const j = await res.json();
      return j.thumbnail_url || null;
    }
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      // YouTube oEmbed (works)
      const api = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(api);
      if (!res.ok) return null;
      const j = await res.json();
      // Some oembed responses contain thumbnail_url
      return j.thumbnail_url || youtubeThumbnail(url) || null;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/* --------------------------
   Helper: fetch og:image from a page
   -------------------------- */
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, { redirect: "follow", timeout: 15000 as any });
    if (!res.ok) return null;
    const html = await res.text();
    // Quick regex to find og:image or twitter:image
    const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']\s*\/?>/i)
      || html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']\s*\/?>/i)
      || html.match(/<meta\s+property=["']og:image:url["']\s+content=["']([^"']+)["']\s*\/?>/i);
    if (ogMatch && ogMatch[1]) {
      const thumbUrl = ogMatch[1].trim();
      // If relative, resolve
      try {
        return new URL(thumbUrl, pageUrl).href;
      } catch (e) {
        return thumbUrl;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/* --------------------------
   Helper: generate PNG thumbnail from PDF URL or Buffer using puppeteer
   -------------------------- */
export async function generatePdfThumbnailFromUrl(pdfUrl: string, width = 900): Promise<Buffer> {
  // This renders the PDF in a page and screenshots first page
  // Note: puppeteer needs to be installed and Chromium available.
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    // Create an HTML wrapper that embeds the PDF in <embed> or <iframe>
    const html = `
      <!doctype html>
      <html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#fff">
        <embed src="${pdfUrl}" type="application/pdf" style="width:100%;height:1200px;" />
      </body></html>
    `;
    await page.setViewport({ width: Math.min(width, 1200), height: 1200 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    // Wait a moment for rendering
    await page.waitForTimeout(800);
    const screenshot = await page.screenshot({ fullPage: false, omitBackground: false }) as Buffer;
    // Use sharp to resize and crop to a nice aspect ratio
    const png = await sharp(screenshot).resize(640, 360, { fit: "cover" }).png().toBuffer();
    return png;
  } finally {
    await browser.close();
  }
}

export async function generatePdfThumbnailFromBuffer(pdfBuffer: Buffer, width = 900): Promise<Buffer> {
  // Save temporarily and serve via data URL? Puppeteer can't directly load PDF from buffer easily.
  // We'll write to a temp file and use file://
  const tmpName = `tmp-${uuidv4()}.pdf`;
  const tmpPath = path.join(process.cwd(), "tmp", tmpName);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });
  await fs.writeFile(tmpPath, pdfBuffer);
  try {
    const fileUrl = `file://${tmpPath}`;
    const buffer = await generatePdfThumbnailFromUrl(fileUrl, width);
    return buffer;
  } finally {
    // clean up temp file
    try { await fs.unlink(tmpPath); } catch (e) { /* ignore */ }
  }
}

/* --------------------------
   Main: generateThumbnailForItem
   input:
     - type: "video" | "pdf" | "page" | "other"
     - sourceUrl: string (url to resource)
     - optional pdfBuffer if you already have uploaded the pdf
   output:
     { url: string, path: string } or null
   -------------------------- */
export async function generateThumbnailForItem(options: {
  type: ItemType;
  sourceUrl?: string;
  pdfBuffer?: Buffer;
  filenamePrefix?: string;
}) {
  const prefix = options.filenamePrefix || "thumb";
  const filename = `${prefix}-${uuidv4()}.png`;

  try {
    // 1) Video
    if (options.type === "video" && options.sourceUrl) {
      // Try quick YouTube pattern
      const yt = youtubeThumbnail(options.sourceUrl);
      if (yt) {
        // fetch the image and optionally save locally/ S3
        try {
          const res = await fetch(yt);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            // normalize size via sharp
            const processed = await sharp(buf).resize(640, 360, { fit: "cover" }).png().toBuffer();
            return await saveBuffer(processed, filename);
          }
        } catch (err) { /* fallback to oEmbed */ }
      }
      // Try oEmbed (Vimeo / YouTube) if above failed
      const o = await fetchOEmbedThumbnail(options.sourceUrl);
      if (o) {
        try {
          const res = await fetch(o);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const processed = await sharp(buf).resize(640, 360, { fit: "cover" }).png().toBuffer();
            return await saveBuffer(processed, filename);
          }
        } catch (err) { /* continue to fallback */ }
      }
    }

    // 2) Page (recipes etc) — try og:image
    if (options.type === "page" && options.sourceUrl) {
      const og = await fetchOgImage(options.sourceUrl);
      if (og) {
        try {
          const res = await fetch(og);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const processed = await sharp(buf).resize(640, 360, { fit: "cover" }).png().toBuffer();
            return await saveBuffer(processed, filename);
          }
        } catch (err) { /* fallback to screenshot of page */ }
      }
      // fallback: screenshot page with puppeteer
      try {
        const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        await page.goto(options.sourceUrl!, { waitUntil: "networkidle0" });
        await page.waitForTimeout(500);
        const shot = await page.screenshot({ fullPage: false }) as Buffer;
        await browser.close();
        const processed = await sharp(shot).resize(640, 360, { fit: "cover" }).png().toBuffer();
        return await saveBuffer(processed, filename);
      } catch (err) {
        // continue
      }
    }

    // 3) PDF
    if (options.type === "pdf") {
      try {
        let pngBuffer: Buffer | null = null;
        if (options.pdfBuffer) {
          pngBuffer = await generatePdfThumbnailFromBuffer(options.pdfBuffer);
        } else if (options.sourceUrl) {
          pngBuffer = await generatePdfThumbnailFromUrl(options.sourceUrl);
        }
        if (pngBuffer) {
          const processed = await sharp(pngBuffer).resize(640, 360, { fit: "cover" }).png().toBuffer();
          return await saveBuffer(processed, filename);
        }
      } catch (err) {
        // fallback to placeholder
      }
    }

    // 4) Fallback placeholder: generate simple image with text using sharp
    const svg = `<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f2f2f2"/>
      <text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle" font-size="28" fill="#666">Sem miniatura disponível</text>
    </svg>`;
    const buf = Buffer.from(svg);
    const png = await sharp(buf).png().toBuffer();
    return await saveBuffer(png, filename);
  } catch (err) {
    console.error("generateThumbnailForItem error:", err);
    return null;
  }
}

/* --------------------------
   Utility: quick helper to get best thumbnail URL for a known source
   (tries patterns first, then generateThumbnailForItem)
   -------------------------- */
export async function getOrCreateThumbnailForSource(params: {
  type: ItemType;
  sourceUrl?: string;
  pdfBuffer?: Buffer;
  filenamePrefix?: string;
}) {
  // 1) fast checks for video providers
  if (params.type === "video" && params.sourceUrl) {
    const yt = youtubeThumbnail(params.sourceUrl);
    if (yt) return { url: yt, generated: false };
    const o = await fetchOEmbedThumbnail(params.sourceUrl);
    if (o) return { url: o, generated: false };
  }

  // 2) try og:image for pages
  if (params.type === "page" && params.sourceUrl) {
    const og = await fetchOgImage(params.sourceUrl);
    if (og) return { url: og, generated: false };
  }

  // 3) generate server-side (will save and return a URL)
  const saved = await generateThumbnailForItem(params);
  if (saved) return { url: saved.url, generated: true };
  return null;
}

/* --------------------------
   Exports
   -------------------------- */
export default {
  generateThumbnailForItem,
  getOrCreateThumbnailForSource,
  youtubeThumbnail,
  fetchOgImage,
};
