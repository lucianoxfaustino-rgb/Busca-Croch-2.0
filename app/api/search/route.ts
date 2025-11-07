export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { okJSON, noContent } from "../_utils/cors";

export async function OPTIONS() { return noContent(); }

type Item = {
  id: string;
  title: string;
  type: "video";
  url: string;
  thumb?: string;
  fonte: "youtube";
};

async function searchYouTube(q: string, max = 10, pageToken?: string): Promise<{ items: Item[]; nextPageToken?: string }> {
  const key = process.env.YOUTUBE_API_KEY!;
  const params = new URLSearchParams({
    part: "snippet",
    q,
    type: "video",
    maxResults: String(Math.min(max, 50)),
    relevanceLanguage: "pt",
    regionCode: "BR",
    videoCategoryId: "26", // Howto & Style (ajuda a priorizar tutoriais)
    safeSearch: "moderate",
    key
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  const json = await res.json();
  if (!json?.items) return { items: [] };

  const items: Item[] = json.items.map((it: any) => {
    const id = it.id?.videoId;
    const s = it.snippet || {};
    const thumb = s?.thumbnails?.medium?.url || s?.thumbnails?.high?.url || s?.thumbnails?.default?.url;
    return {
      id: `yt_${id}`,
      title: s.title,
      type: "video",
      url: `https://www.youtube.com/watch?v=${id}`,
      thumb,
      fonte: "youtube" as const
    };
  });

  return { items, nextPageToken: json.nextPageToken };
}

export async function POST(req: NextRequest) {
  try {
    const { query, pageToken } = await req.json();
    if (!query || typeof query !== "string") {
      return okJSON({ error: "Campo 'query' é obrigatório" }, 400);
    }

    // Refina o texto pra PT-BR “aulas”
    const q = `${query} crochê aula passo a passo como fazer tutorial em português`;

    const { items, nextPageToken } = await searchYouTube(q, 10, pageToken);
    return okJSON({ results: items, nextPageToken });
  } catch (err: any) {
    return okJSON({ error: err?.message || "Erro interno" }, 500);
  }
}
