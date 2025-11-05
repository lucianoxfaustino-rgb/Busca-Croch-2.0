// app/api/search/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "items.json");

async function readDb() {
  try {
    const t = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(t);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.toLowerCase() || "";
    const items = await readDb();
    if (!q) return NextResponse.json({ items });
    const filtered = items.filter((it: any) =>
      (it.title || "").toLowerCase().includes(q) ||
      (it.type || "").toLowerCase().includes(q)
    );
    return NextResponse.json({ items: filtered });
  } catch (err: any) {
    console.error("search error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
