export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { okJSON, noContent } from "../_utils/cors";

export async function OPTIONS() { return noContent(); }

type Item = {
  id: string;
  title: string;
  type: "video" | "pdf" | "receita" | "texto";
  url: string;
  thumb?: string;
  fonte: "youtube" | "cse";
};

async function searchYouTube(q: string, max = 10): Promise<Item[]> {
  const key = process.env.YOUTUBE_API_KEY!;
  const params = new URLSearchParams({
    part: "snippet",
    q,
    type: "video",
    maxResults: String(Math.min(max, 50)),
    relevanceLanguage: "pt",
    regionCode: "BR",
    videoCategoryId: "26",
    safeSearch: "moderate",
    key
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const json = await res.json();
  if (!json?.items) return [];
  return json.items.map((it: any) => {
    const id = it.id?.videoId;
    const s = it.snippet || {};
    const thumb = s?.thumbnails?.medium?.url || s?.thumbnails?.high?.url || s?.thumbnails?.default?.url;
    return {
      id: `yt_${id}`,
      title: s.title,
      type: "video" as const,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumb,
      fonte: "youtube" as const
    };
  });
}

async function searchCSE(q: string, max = 10): Promise<Item[]> {
  const key = process.env.GOOGLE_API_KEY!;
  const cx = process.env.CSE_ID!;
  const params = new URLSearchParams({
    q,
    cx,
    key,
    num: String(Math.min(max, 10)),
    lr: "lang_pt",
    cr: "countryBR",
    safe: "active"
  });
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
  const json = await res.json();
  if (!json?.items) return [];

  return json.items.map((it: any, idx: number) => {
    const link = it.link;
    const title = it.title;
    const pagemap = it.pagemap || {};
    const thumb = pagemap?.cse_thumbnail?.[0]?.src || pagemap?.cse_image?.[0]?.src;
    let type: Item["type"] = "texto";
    if (link?.toLowerCase().includes(".pdf")) type = "pdf";
    if (/receita|passo a passo/i.test(title) || /receita|passo a passo/i.test(it.snippet||"")) type = "receita";
    return {
      id: `cse_${idx}_${Date.now()}`,
      title,
      type,
      url: link,
      thumb,
      fonte: "cse" as const
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const { query, filtros } = await req.json();
    if (!query || typeof query !== "string") {
      return okJSON({ error: "Campo 'query' é obrigatório" }, 400);
    }

    const q = `${query} crochê passo a passo tutorial receita pdf vídeo`;

    let yt: Item[] = [];
    let cse: Item[] = [];

    if (filtros?.tipo === "video") {
      [yt, cse] = await Promise.all([ searchYouTube(q, 8), searchCSE(q, 12) ]);
    } else if (filtros?.tipo === "pdf" || filtros?.tipo === "receita") {
      cse = await searchCSE(q, 20);
    } else {
      cse = await searchCSE(q, 20);
      yt = []; // YouTube só quando usuário clicar em "Vídeos"
    }

    let results = [...yt, ...cse];
    if (filtros?.tipo) results = results.filter(r => r.type === filtros.tipo);

    const rank: Record<Item["type"], number> = { video: 0, receita: 1, pdf: 2, texto: 3 };
    results.sort((a, b) => rank[a.type] - rank[b.type]);

    return okJSON({ results });
  } catch (err: any) {
    return okJSON({ error: err?.message || "Erro interno" }, 500);
  }
}
