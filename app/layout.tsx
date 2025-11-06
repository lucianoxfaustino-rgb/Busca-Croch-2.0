import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Busca Crochê por Imagem",
  description: "Identifique a peça e ache aulas, receitas e PDFs em PT-BR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
