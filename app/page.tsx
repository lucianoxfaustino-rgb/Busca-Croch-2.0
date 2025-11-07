"use client";
import { useState } from "react";

type ResultItem = {
  id: string;
  title: string;
  type: "video";
  url: string;
  thumb?: string;
  fonte: "youtube";
};

export default function Page() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(token?: string, append = false) {
    try {
      setLoading(true); setError(null);
      const body: any = { query: q.trim() };
      if (token) body.pageToken = token;
      const resp = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Falha na busca.");
      setResults(prev => append ? [...prev, ...(data.results || [])] : (data.results || []));
      setNextPageToken(data.nextPageToken);
    } catch (e: any) {
      setError(e?.message || "Erro ao buscar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 860, margin: "40px auto", padding: 16 }}>
      <h1 style={{ margin: 0 }}>Aulas de Crochê no YouTube</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        Digite o que você procura (ex.: “bolsa boho ponto pipoca”, “sousplat redondo”).
      </p>

      <div style={{ display:"flex", gap:8, marginTop:12 }}>
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Ex.: bolsa boho ponto pipoca"
          style={{ flex:1, padding:"10px 12px", border:"1px solid #ddd", borderRadius:8 }}
        />
        <button onClick={()=>search()} disabled={loading || !q.trim()} style={{ padding:"10px 14px", borderRadius:8 }}>
          {loading ? "Buscando..." : "Buscar vídeos"}
        </button>
      </div>

      {error && <div style={{ color:"#b00", marginTop:10 }}>{error}</div>}

      <ul style={{ display:"grid", gap:12, listStyle:"none", padding:0, marginTop:16 }}>
        {results.map((it)=>(
          <li key={it.id} style={{ border:"1px solid #eee", borderRadius:12, padding:12 }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              {it.thumb && <img src={it.thumb} alt="" width={120} height={68} style={{ objectFit:"cover", borderRadius:8 }} />}
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600 }}>{it.title}</div>
                <div style={{ fontSize:12, color:"#666" }}>YOUTUBE</div>
                <a href={it.url} target="_blank" style={{ display:"inline-block", marginTop:6 }}>
                  Abrir
                </a>
              </div>
            </div>
          </li>
        ))}
        {!results.length && !loading && <li style={{ color:"#666" }}>Sem resultados ainda.</li>}
      </ul>

      {nextPageToken && (
        <div style={{ marginTop:12 }}>
          <button onClick={()=>search(nextPageToken, true)} disabled={loading} style={{ padding:"10px 14px", borderRadius:8 }}>
            {loading ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      )}
    </main>
  );
}
