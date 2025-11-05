// app/components/ImageSearchClient.tsx
"use client";
import React, { useEffect, useState } from "react";

type Item = {
  id: string;
  title: string;
  type: string;
  sourceUrl: string;
  thumbnailUrl?: string | null;
  createdAt?: string;
};

export default function ImageSearchClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchItems(query = "") {
    setLoading(true);
    try {
      const res = await fetch(`/api/search${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      const j = await res.json();
      setItems(j.items || []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 8 }}>Busca - Busca-Croch-2.0</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Pesquisar título ou tipo..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button onClick={() => fetchItems(q)} style={{ padding: "8px 12px", borderRadius: 6 }}>
          Buscar
        </button>
        <button onClick={() => { setQ(""); fetchItems(""); }} style={{ padding: "8px 12px", borderRadius: 6 }}>
          Limpar
        </button>
      </div>

      {loading ? <div>Carregando...</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {items.map((it) => (
          <div key={it.id} style={{ border: "1px solid #eee", padding: 8, borderRadius: 8, background: "#fff" }}>
            <div style={{ width: "100%", height: 140, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 6, background: "#f8f8f8" }}>
              {it.thumbnailUrl ? (
                <img src={it.thumbnailUrl} alt={it.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ color: "#888" }}>Sem miniatura</div>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 14 }}>{it.title}</strong>
              <div style={{ fontSize: 12, color: "#666" }}>{it.type} • {it.createdAt?.slice(0,10)}</div>
              <a href={it.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 13 }}>Abrir origem</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
