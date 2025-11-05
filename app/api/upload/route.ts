// app/api/upload/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import vision from "../../../server/vision";

const DB_PATH = path.join(process.cwd(), "app", "data", "items.json");

async function readDb() {
  try {
    const t = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(t);
  } catch {
    return [];
  }
}
async function writeDb(items: any[]) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(items, null, 2), "utf-8");
}

/**
 * Recebe { title, type, sourceUrl, thumbnail? }
 * Se thumbnail não for informado, tenta detectar:
 * - YouTube thumbnail (img.youtube.com)
 * - og:image da página (via server/vision.fetchOgImage)
 * - fallback: default.svg em public/thumbnails
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, type, sourceUrl, thumbnail } = body;

    if (!title || !type || !sourceUrl) {
      return NextResponse.json({ error: "title, type and sourceUrl are required" }, { status: 400 });
    }

    let finalThumbnail = thumbnail || null;

    // se não veio thumbnail, tente detectar
    if (!finalThumbnail) {
      // 1) quick YouTube detection (vision.youtubeThumbnail pode existir)
      try {
        const yt = (vision.youtubeThumbnail && typeof vision.youtubeThumbnail === "function")
          ? vision.youtubeThumbnail(sourceUrl)
          : null;
        if (yt) finalThumbnail = yt;
      } catch (e) { /* ignore */ }
    }

    if (!finalThumbnail) {
      // 2) try og:image (vision.fetchOgImage)
      try {
        if (vision.fetchOgImage && typeof vision.fetchOgImage === "function") {
          const og = await vision.fetchOgImage(sourceUrl);
          if (og) finalThumbnail = og;
        }
      } catch (e) { /* ignore */ }
    }

    // 3) fallback para default.svg se ainda não tiver
    if (!finalThumbnail) {
      finalThumbnail = "/thumbnails/default.svg";
    } else {
      // se finalThumbnail é caminho relativo (ex.: apenas nome de arquivo), normalize para /thumbnails/...
      if (!finalThumbnail.startsWith("http") && !finalThumbnail.startsWith("/")) {
        finalThumbnail = `/thumbnails/${finalThumbnail}`;
      }
    }

    const items = await readDb();
    const nextId = items.length ? Number(items[items.length - 1].id) + 1 : 1;
    const item = {
      id: String(nextId),
      title,
      type,
      sourceUrl,
      thumbnail: finalThumbnail, // aqui guardamos a url completa ou relativa
      createdAt: new Date().toISOString(),
    };
    items.push(item);
    await writeDb(items);

    return NextResponse.json({ ok: true, item });
  } catch (err: any) {
    console.error("upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
