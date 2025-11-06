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
      const file = form.get("image") as File | null;
      if (!file) return okJSON({ error: "Arquivo 'image' ausente" }, 400);
      const arrayBuffer = await file.arrayBuffer();
      // Buffer está disponível no runtime nodejs
      const b64 = Buffer.from(arrayBuffer).toString("base64");
      imageUrl = toDataURL(file.type || "image/jpeg", b64);
    } else {
      const body = await req.json().catch(()=>({}));
      if (body?.imageUrl && typeof body.imageUrl === "string") {
        imageUrl = body.imageUrl;
      }
    }

    if (!imageUrl) return okJSON({ error: "Envie 'image' (arquivo) ou 'imageUrl' (string)" }, 400);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const system = `
Você descreve imagens de CROCHÊ para busca.
Saída (JSON) com:
- tipo: "bolsa" | "blusa" | "tapete" | "sousplat" | "amigurumi" | "capa" | "outro"
- pontos: string[] (ex.: "puff","alto","baixo","leque","pipoca","trançado")
- estilo: string (ex.: "boho","praia","quadrado da vovó","geométrico")
- materiais: string[] (ex.: "barbante","fio de malha","linha de algodão","alça de couro")
- termos_busca: string[] (sinônimos PT-BR úteis p/ achar aulas e receitas)
Responda SOMENTE JSON válido.`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Analise a imagem e gere o JSON solicitado." },
            { type: "input_image", image_url: imageUrl }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "CrocheIdentify",
          schema: {
            type: "object",
            properties: {
              tipo: { type: "string" },
              pontos: { type: "array", items: { type: "string" } },
              estilo: { type: "string" },
              materiais: { type: "array", items: { type: "string" } },
              termos_busca: { type: "array", items: { type: "string" } }
            },
            required: ["tipo","pontos","termos_busca"],
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
