// app/api/upload/route.ts
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
async function writeDb(items: any[]) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(items, null, 2), "utf-8");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, type, sourceUrl, thumbnail } = body;

    if (!title || !type || !sourceUrl) {
      return NextResponse.json({ error: "title, type and sourceUrl are required" }, { status: 400 });
    }

    const items = await readDb();
    const nextId = items.length ? Number(items[items.length - 1].id) + 1 : 1;
    const item = {
      id: String(nextId),
      title,
      type,
      sourceUrl,
      thumbnail: thumbnail || null, // pode ser nome de arquivo em public/thumbnails ou URL externa
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
