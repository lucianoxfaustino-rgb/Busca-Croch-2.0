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

async function searchYouTube(q: string, max = 8): Promise<Item[]> {
  const key = process.env.YOUTUBE_API_KEY!;
  const params = new URLSearchParams({
    part: "snippet",
    q, type: "video",
    relevanceLanguage: "pt",
    regionCode: "BR",
    maxResults: String(max),
    key
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const json = await res.json();

  if (!json?.items) return [];
  return json.items.map((it: any) => {
    const id = it.id?.videoId;
    const s = it.snippet || {};
    return {
      id: `yt_${id}`,
      title: s.title,
      type: "video",
      url: `https://www.youtube.com/watch?v=${id}`,
      thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      fonte: "youtube" as const
    };
  });
}

function guessTypeFromLink(link: string, mime?: string): Item["type"] {
  if ((mime && mime.includes("pdf")) || link.toLowerCase().endsWith(".pdf")) return "pdf";
  if (link.includes("youtube.com") || link.includes("youtu.be")) return "video";
  if (link.match(/receita|passo-a-passo|como-fazer|tutorial/i)) return "receita";
  return "texto";
}

async function searchCSE(q: string, max = 12): Promise<Item[]> {
  const key = process.env.GOOGLE_API_KEY!;
  const cx = process.env.CSE_ID!;
  const params = new URLSearchParams({
    key, cx, q,
    num: String(Math.min(max, 10)),
    gl: "br",
    lr: "lang_pt"
  });
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
  const json = await res.json();
  if (!json?.items) return [];

  return json.items.map((it: any, idx: number) => {
    const link = it.link as string;
    const thumb =
      it.pagemap?.cse_image?.[0]?.src ||
      it.pagemap?.metatags?.[0]?.["og:image"];
    const type = guessTypeFromLink(link, it.mime);
    return {
      id: `cse_${idx}`,
      title: it.title,
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

    // Favorece tutoriais PT-BR
    const q = `${query} crochê passo a passo tutorial receita pdf vídeo`;

    const [yt, cse] = await Promise.all([ searchYouTube(q, 8), searchCSE(q, 12) ]);
    let results = [...yt, ...cse];

    if (filtros?.tipo) results = results.filter(r => r.type === filtros.tipo);

    const rank: Record<Item["type"], number> = { video: 0, receita: 1, pdf: 2, texto: 3 };
    results.sort((a, b) => rank[a.type] - rank[b.type]);

    return okJSON({ results });
  } catch (err: any) {
    return okJSON({ error: err?.message || "Erro interno" }, 500);
  }
}
