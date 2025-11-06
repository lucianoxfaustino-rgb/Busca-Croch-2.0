"use client";
import { useState, useRef } from "react";

type IdentifyOut = {
  tipo?: string;
  pontos?: string[];
  estilo?: string;
  materiais?: string[];
  termos_busca?: string[];
};

type ResultItem = {
  id: string;
  title: string;
  type: "video" | "pdf" | "receita" | "texto";
  url: string;
  thumb?: string;
  fonte: "youtube" | "cse";
};

export default function Page() {
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [identify, setIdentify] = useState<IdentifyOut | null>(null);
  const [aiQuery, setAiQuery] = useState<{ intent:string; query:string; entities:string[] } | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle"|"identified"|"searched">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [filtro, setFiltro] = useState<""|"video"|"receita"|"pdf">("");

  async function onChooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImgPreview(url);
    setIdentify(null);
    setAiQuery(null);
    setResults([]);
    setStage("idle");
  }

  async function handleIdentify() {
    try {
      setError(null); setLoading(true);
      const f = fileRef.current?.files?.[0];
      if (!f) { setError("Selecione uma imagem primeiro."); setLoading(false); return; }
      const fd = new FormData();
      fd.append("image", f);

      const out = await fetch("/api/identify", { method:"POST", body: fd }).then(r=>r.json());
      if (out.error) throw new Error(out.error);
      setIdentify(out);
      setStage("identified");

      const ai = await fetch("/api/ai-query", {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(out)
      }).then(r=>r.json());
      if (ai.error) throw new Error(ai.error);
      setAiQuery(ai);
    } catch (e: any) {
      setError(e?.message || "Falha na identificação.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(tipo?: "video"|"receita"|"pdf") {
    try {
      setError(null); setLoading(true);
      const q = aiQuery?.query || (identify?.termos_busca?.join(" ") || "");
      const body: any = { query: q.trim() };
      if (tipo) { body.filtros = { tipo }; setFiltro(tipo); } else { setFiltro(""); }
      const data = await fetch("/api/search", {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(body)
      }).then(r=>r.json());
      if (data.error) throw new Error(data.error);
      setResults(data.results || []);
      setStage("searched");
    } catch (e: any) {
      setError(e?.message || "Falha na busca.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: "40px auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>Busca Crochê por Imagem</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        Envie uma foto da peça de crochê → Identificar → Buscar aulas em vídeo, receitas e PDFs (PT-BR).
      </p>

      <div style={{ border:"1px solid #eee", borderRadius: 12, padding: 16, display:"grid", gap: 12 }}>
        <input type="file" accept="image/*" ref={fileRef} onChange={onChooseFile} />
        {imgPreview && (
          <img src={imgPreview} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 12 }} />
        )}
        <button onClick={handleIdentify} disabled={loading} style={{ padding:"10px 14px", borderRadius: 8 }}>
          {loading ? "Processando..." : "Identificar peça"}
        </button>

        {error && <div style={{ color:"#b00" }}>{error}</div>}

        {identify && (
          <div style={{ background:"#fafafa", border:"1px solid #eee", borderRadius:12, padding:12 }}>
            <b>Identificação:</b><br/>
            <div><b>Tipo:</b> {identify.tipo || "—"}</div>
            <div><b>Pontos:</b> {identify.pontos?.join(", ") || "—"}</div>
            <div><b>Estilo:</b> {identify.estilo || "—"}</div>
            <div><b>Materiais:</b> {identify.materiais?.join(", ") || "—"}</div>
            <div><b>Termos:</b> {identify.termos_busca?.join(", ") || "—"}</div>
          </div>
        )}

        {aiQuery && (
          <div style={{ fontSize: 13, color:"#666" }}>
            <div><b>Intenção:</b> {aiQuery.intent}</div>
            <div><b>Query normalizada:</b> {aiQuery.query}</div>
            <div><b>Entities:</b> {aiQuery.entities.join(", ")}</div>
          </div>
        )}

        <div style={{ display:"flex", gap: 8, flexWrap:"wrap" }}>
          <button onClick={()=>handleSearch()} disabled={loading || !aiQuery} style={{ padding:"8px 12px", borderRadius: 8 }}>
            {loading ? "Buscando..." : "Buscar (Tudo)"}
          </button>
          <button onClick={()=>handleSearch("video")} disabled={loading || !aiQuery} style={{ padding:"8px 12px", borderRadius: 8 }}>
            Vídeos
          </button>
          <button onClick={()=>handleSearch("receita")} disabled={loading || !aiQuery} style={{ padding:"8px 12px", borderRadius: 8 }}>
            Receitas
          </button>
          <button onClick={()=>handleSearch("pdf")} disabled={loading || !aiQuery} style={{ padding:"8px 12px", borderRadius: 8 }}>
            PDFs
          </button>
        </div>
      </div>

      {stage !== "idle" && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ margin: "8px 0" }}>
            Resultados {filtro ? `(${filtro})` : ""}
          </h3>
          <ul style={{ display:"grid", gap:12, listStyle:"none", padding:0 }}>
            {results.map((it)=>(
              <li key={it.id} style={{ border:"1px solid #eee", borderRadius:12, padding:12 }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  {it.thumb && <img src={it.thumb} alt="" width={96} height={64} style={{ objectFit:"cover", borderRadius:8 }} />}
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600 }}>{it.title}</div>
                    <div style={{ fontSize:12, color:"#666" }}>
                      {it.type.toUpperCase()} • {it.fonte.toUpperCase()}
                    </div>
                    <a href={it.url} target="_blank" style={{ display:"inline-block", marginTop:6 }}>
                      Abrir
                    </a>
                  </div>
                </div>
              </li>
            ))}
            {!results.length && <li style={{ color:"#666" }}>Sem resultados.</li>}
          </ul>
        </div>
      )}
    </main>
  );
}
