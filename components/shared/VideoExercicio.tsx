"use client";

import { useState } from "react";
import { Play } from "lucide-react";

import { interpretarVideo } from "@/lib/utils/video";

interface VideoExercicioProps {
  url: string | null;
  nome: string;
}

/**
 * O iframe só entra no DOM depois do clique: uma tela de treino pode ter dez
 * exercícios, e dez players do YouTube carregados de uma vez travam o celular.
 */
export function VideoExercicio({ url, nome }: VideoExercicioProps) {
  const [aberto, setAberto] = useState(false);
  const fonte = interpretarVideo(url);

  if (!fonte) return null;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
          <Play className="size-4 fill-current" aria-hidden />
        </span>
        Ver como se faz
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-black">
      {fonte.tipo === "arquivo" ? (
        <video
          src={fonte.url}
          controls
          autoPlay
          playsInline
          preload="metadata"
          className="aspect-video w-full"
        />
      ) : (
        <iframe
          src={`${fonte.embedUrl}${fonte.tipo === "youtube" ? "&autoplay=1" : "?autoplay=1"}`}
          title={`Demonstração do exercício ${nome}`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      )}
    </div>
  );
}
