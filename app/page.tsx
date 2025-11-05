// app/page.tsx
import React from "react";
import ImageSearchClient from "./components/ImageSearchClient";

async function postItem(payload: { title: string; type: string; sourceUrl: string }) {
  return fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
}

export default function Page() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Busca-Croch-2.0</h1>
      <section style={{ marginBottom: 20 }}>
        <h3>Adicionar item (teste rápido)</h3>
        <AddItemForm onAdded={() => {
          // reload will be handled by client component's initial fetch; a simple page reload keeps it simple
          window.location.reload();
        }} />
      </section>
      <ImageSearchClient />
    </main>
  );
}

function AddItemForm({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState("video");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await postItem({ title, type, sourceUrl });
      if (res?.ok) {
        setTitle(""); setSourceUrl("");
        onAdded();
      } else {
        alert("Erro: " + (res?.error || "desconhecido"));
      }
    } catch (err) {
      alert("Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8, maxWidth: 720 }}>
      <input placeholder="Título (ex: Receita Bolsa X)" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="video">video</option>
        <option value="pdf">pdf</option>
        <option value="page">page</option>
        <option value="other">other</option>
      </select>
      <input placeholder="URL da origem (YouTube, link do PDF ou página)" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} required />
      <div>
        <button type="submit" disabled={loading}>{loading ? "Enviando..." : "Enviar"}</button>
      </div>
    </form>
  );
}
