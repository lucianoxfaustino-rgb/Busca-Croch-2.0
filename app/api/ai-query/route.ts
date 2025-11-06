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
Saída JSON:
- intent: "video" | "pdf" | "receita" | "misto"
- query: string (curta, ótima para buscar aulas/receitas em PT-BR)
- entities: string[] (palavras-chave importantes)
Atenção: MAIORIZAR termos brasileiros (ponto pipoca~puff, fio barbante etc.).
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(body) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "SearchIntent",
          schema: {
            type: "object",
            properties: {
              intent: { type: "string", enum: ["video","pdf","receita","misto"] },
              query: { type: "string" },
              entities: { type: "array", items: { type: "string" } }
            },
            required: ["intent","query","entities"],
            additionalProperties: false
          }
        }
      }
    });

    const out = JSON.parse(response.output_text!);
    return okJSON(out);
  } catch (err: any) {
    return okJSON({ error: err?.message || "Erro interno" }, 500);
  }
}
