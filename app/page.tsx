"use client";
import { useRef, useState } from "react";

type Identify = {
  tipo: string;
  pontos: string[];
  estilo?: string;
  materiais?: string[];
  termos_busca: string[];
};

type AIQuery = { intent: "misto"|"video"|"pdf"|"receita"; query: string; entities: string[]; };

type ResultItem = {
  id: string;
  title: string;
  type: "video" | "pdf" | "receita" | "texto";
  url: string;
  thumb?: string;
  fonte: "youtube" | "cse";
};

export default function Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [identify, setIdentify] = useState<Identify| null>(null);
  const [aiQuery, setAiQuery] = useState<AIQuery | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleIdentify() {
    try {
      setError(null); setLoading(true); setResults([]); setAiQuery(null);
      const f = fileRef.current?.files?.[0];
      if (!f) { setError("Selecione uma imagem."); setLoading(false); return; }
      const fd = new FormData(); fd.append("image", f);

      const resp = await fetch("/api/identify", { method:"POST", body: fd });
      const out = await resp.json();
      if (!resp.ok) throw new Error(out?.error || "Falha na identificação.");
      if (out?.error) throw new Error(out.error);
      setIdentify(out);

      const aiResp = await fetch("/api/ai-query", {
        method:"POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(out)
      });
      const ai = await aiResp.json();
      if (!aiResp.ok) throw new Error(ai?.error || "Falha ao gerar consulta.");
      if (ai.error) throw new Error(ai.error);
      setAiQuery(ai);
    } catch (e: any) {
      setError(e?.message || "Erro.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(tipo?: "video"|"pdf"|"receita") {
    if (!aiQuery) { setError("Identifique a peça primeiro."); return; }
    try {
      setError(null); setLoading(true);
      const resp = await fetch("/api/search", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ query: aiQuery.query, filtros: tipo ? { tipo } : undefined })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Falha na busca.");
      setResults(data.results || []);
    } catch (e: any) {
      setError(e?.message || "Erro.");
    } finally { setLoading(false); }
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>Busca Crochê (Imagem → Aulas & Receitas)</h1>
      <p style={{ color:"#555" }}>Envie a foto da peça, identifique os termos e busque vídeos/receitas/PDFs.</p>

      <div style={{ display:"grid", gap:10, border:"1px solid #eee", borderRadius:12, padding:12 }}>
        <input ref={fileRef} type="file" accept="image/*" />
        <button onClick={handleIdentify} disabled={loading} style={{ padding:"10px 14px", borderRadius:8 }}>
          {loading ? "Processando..." : "Identificar peça"}
        </button>

        {identify && (
          <div style={{ fontSize:14, color:"#333", background:"#fafafa", padding:10, borderRadius:8 }}>
            <b>Tipo:</b> {identify.tipo || "—"}<br/>
            <b>Pontos:</b> {(identify.pontos||[]).join(", ") || "—"}<br/>
            <b>Estilo:</b> {identify.estilo || "—"}<br/>
            <b>Materiais:</b> {(identify.materiais||[]).join(", ") || "—"}<br/>
            <b>Termos:</b> {(identify.termos_busca||[]).join(", ") || "—"}
          </div>
        )}

        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={()=>handleSearch()} disabled={!aiQuery || loading} style={{ padding:"8px 12px", borderRadius:8 }}>Buscar (Tudo)</button>
          <button onClick={()=>handleSearch("video")} disabled={!aiQuery || loading} style={{ padding:"8px 12px", borderRadius:8 }}>Vídeos</button>
          <button onClick={()=>handleSearch("receita")} disabled={!aiQuery || loading} style={{ padding:"8px 12px", borderRadius:8 }}>Receitas</button>
          <button onClick={()=>handleSearch("pdf")} disabled={!aiQuery || loading} style={{ padding:"8px 12px", borderRadius:8 }}>PDFs</button>
        </div>

        {error && <div style={{ color:"#b00" }}>{error}</div>}

        <div style={{ display:"grid", gap:12, marginTop:8 }}>
          {results.map((it)=>(
            <div key={it.id} style={{ border:"1px solid #eee", borderRadius:12, padding:12, display:"flex", gap:12, alignItems:"center" }}>
              {it.thumb && <img src={it.thumb} width={120} height={74} style={{ borderRadius:8, objectFit:"cover" }} />}
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600 }}>{it.title}</div>
                <div style={{ fontSize:12, color:"#666" }}>{it.type.toUpperCase()} • {it.fonte.toUpperCase()}</div>
                <a href={it.url} target="_blank" style={{ display:"inline-block", marginTop:6 }}>Abrir</a>
              </div>
            </div>
          ))}
          {!results.length && !loading && <div style={{ color:"#666" }}>Nenhum resultado ainda.</div>}
        </div>
      </div>
    </main>
  );
}
