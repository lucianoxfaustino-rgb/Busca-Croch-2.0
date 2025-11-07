export const runtime = "nodejs";

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { okJSON, noContent } from "../_utils/cors";

export async function OPTIONS() { return noContent(); }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const system = `
Você cria consultas curtas de busca (PT-BR) para crochê.
Entrada: descritores (tipo, pontos, estilo, materiais, termos_busca).
REGRAS:
- Responda SOMENTE com JSON válido:
{
  "intent": "misto" | "video" | "pdf" | "receita",
  "query": "string",
  "entities": ["string", ...]
}
- Inclua termos brasileiros ("ponto pipoca/puff", "barbante", etc.).
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(body) }
      ]
    });

    const text = completion.choices[0]?.message?.content?.trim() || "{}";
    const jsonText = text.replace(/^```json\s*|\s*```$/g, "");
    const out = JSON.parse(jsonText);

    if (!out.intent || !out.query || !Array.isArray(out.entities)) {
      return okJSON({ error: "Resposta inválida do modelo (faltam campos)." }, 500);
    }
    return okJSON(out);
  } catch (err: any) {
    return okJSON({ error: err?.message || "Erro interno" }, 500);
  }
}
