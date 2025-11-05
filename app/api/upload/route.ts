// app/api/upload/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import vision from "../../../server/vision";

const DB_PATH = path.join(process.cwd(), "data", "items.json");

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, type, sourceUrl } = body;
    if (!title || !type || !sourceUrl) {
      return NextResponse.json({ error: "title, type and sourceUrl are required" }, { status: 400 });
    }

    // use vision util
    const res = await vision.getOrCreateThumbnailForSource({
      type: type,
      sourceUrl,
      filenamePrefix: type.replace(/\W+/g, "")
    });

    const thumbnailUrl = res?.url || null;
    const items = await readDb();
    const id = (items.length ? (Number(items[items.length - 1].id) + 1) : 1).toString();
    const item = {
      id,
      title,
      type,
      sourceUrl,
      thumbnailUrl,
      createdAt: new Date().toISOString()
    };
    items.push(item);
    await writeDb(items);

    return NextResponse.json({ ok: true, item });
  } catch (err: any) {
    console.error("upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
