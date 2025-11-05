import fs from "fs";
import path from "path";

// Função auxiliar para buscar as miniaturas (thumbnails) dos vídeos, PDFs ou receitas
export async function getThumbnails(query: string) {
  const dataPath = path.join(process.cwd(), "app/data/items.json");

  if (!fs.existsSync(dataPath)) {
    return [];
  }

  const jsonData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const results = jsonData.filter((item: any) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  // Adiciona o caminho das miniaturas
  const enhancedResults = results.map((item: any) => ({
    ...item,
    thumbnail: item.thumbnail
      ? `/thumbnails/${item.thumbnail}`
      : "/thumbnails/default.png", // miniatura padrão caso não exista
  }));

  return enhancedResults;
}

// Exemplo de função de teste — pode ser chamada no futuro via API
export async function analyzeImage(filePath: string) {
  const fileExists = fs.existsSync(filePath);
  if (!fileExists) {
    return { success: false, message: "Arquivo não encontrado." };
  }

  // Aqui poderemos adicionar no futuro a integração com IA para leitura da imagem
  return { success: true, message: "Análise simulada concluída." };
}
