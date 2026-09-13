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
        className="group flex h-12 w-full items-center gap-3 rounded-full bg-neutral-50 pr-5 pl-1.5 text-[15px] font-medium text-neutral-700 ring-1 ring-neutral-200/90 transition-all duration-200 hover:bg-neutral-100 active:scale-[.98]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-grafite text-ciano">
          <Play className="ml-0.5 size-4 fill-current" aria-hidden />
        </span>
        Ver como se faz
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-grafite">
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
