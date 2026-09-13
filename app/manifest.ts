import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Central de Saúde Conectada",
    short_name: "Saúde Conectada",
    description:
      "Treino, indicadores clínicos e medicamentos. O centro cuidando de você todos os dias.",
    lang: "pt-BR",
    // Instalado, o app abre direto na home do aluno, não na landing.
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F6F6",
    theme_color: "#F3F6F6",
    categories: ["health", "fitness", "medical"],
    icons: [
      {
        src: "/icones/icone-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icones/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icones/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Registrar indicador",
        short_name: "Indicadores",
        url: "/indicadores",
      },
      { name: "Treino de hoje", short_name: "Treino", url: "/treino" },
      { name: "Meus remédios", short_name: "Remédios", url: "/remedios" },
    ],
  };
}
