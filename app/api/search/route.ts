// app/api/search/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DB_PATH = path.join(process.cwd(), "app", "data", "items.json");

async function readDb() {
  try {
    const t = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(t);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const items = await readDb();

    // mapeia thumbnail para caminho público (fallback se for null)
    const mapped = items.map((it: any) => ({
      ...it,
      thumbnailUrl: it.thumbnail
        ? (it.thumbnail.startsWith("http") ? it.thumbnail : `/thumbnails/${it.thumbnail}`)
        : "/thumbnails/default.svg",
    }));

    if (!q) return NextResponse.json({ items: mapped });

    const filtered = mapped.filter((it: any) =>
      (it.title || "").toLowerCase().includes(q) ||
      (it.type || "").toLowerCase().includes(q)
    );

    return NextResponse.json({ items: filtered });
  } catch (err: any) {
    console.error("search error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
