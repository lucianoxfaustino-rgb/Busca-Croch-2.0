export const runtime = "nodejs";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { okJSON, noContent } from "../_utils/cors";

export async function OPTIONS() { return noContent(); }

function toDataURL(mime: string, b64: string) {
  return `data:${mime};base64,${b64}`;
}

export async function POST(req: NextRequest) {
  try {
    let imageUrl: string | null = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image") as any; // 'any' evita problema de tipos no build
      if (!file) return okJSON({ error: "Arquivo 'image' ausente" }, 400);
      const arrayBuffer = await file.arrayBuffer();
      const b64 = Buffer.from(arrayBuffer).toString("base64");
      imageUrl = toDataURL(file.type || "image/jpeg", b64); // data URL inline
    } else {
      const body = await req.json().catch(()=>({}));
      if (body?.imageUrl && typeof body.imageUrl === "string") {
        imageUrl = body.imageUrl;
      }
    }

    if (!imageUrl) return okJSON({ error: "Envie 'image' (arquivo) ou 'imageUrl' (string)" }, 400);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const system = `
Você descreve imagens de CROCHÊ para busca. Regras:
- Responda SOMENTE com JSON válido (sem texto fora).
- Estrutura:
{
  "tipo": "bolsa" | "blusa" | "tapete" | "sousplat" | "amigurumi" | "capa" | "outro",
  "pontos": ["puff","alto","baixo","leque","pipoca","trançado", ...],
  "estilo": "boho" | "praia" | "quadrado da vovó" | "geométrico" | "minimalista" | "clássico" | "outro",
  "materiais": ["barbante","fio de malha","linha de algodão","alça de couro", ...],
  "termos_busca": ["bolsa boho crochê ponto pipoca", ...]
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "Analise a imagem e devolva o JSON solicitado." },
            { type: "image_url", image_url: { url: imageUrl } }
          ] as any
        }
      ]
    });

    const text = completion.choices[0]?.message?.content?.trim() || "{}";
    const jsonText = text.replace(/^```json\s*|\s*```$/g, "");
    const out = JSON.parse(jsonText);

    if (!out.tipo || !Array.isArray(out.pontos) || !Array.isArray(out.termos_busca)) {
      return okJSON({ error: "Resposta inválida do modelo (faltam campos)." }, 500);
    }

    return okJSON(out);
  } catch (err: any) {
    return okJSON({ error: err?.message || "Erro interno" }, 500);
  }
}
