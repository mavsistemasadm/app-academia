"use client";

import { useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { ATERRAMENTO } from "@/lib/utils/bem-estar";

/**
 * Técnica 5-4-3-2-1. Um passo por vez, de propósito: em crise de ansiedade
 * uma lista inteira na tela é mais uma coisa para dar conta.
 */
export function GuiaAterramento() {
  const [passo, setPasso] = useState(-1);

  if (passo === -1) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <h3 className="text-base font-bold text-neutral-900">
            Estou ansioso agora
          </h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            Cinco passos curtos para trazer sua atenção de volta ao corpo. Leva
            uns dois minutos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPasso(0)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          Começar
          <ArrowRight className="size-5" aria-hidden />
        </button>
      </div>
    );
  }

  if (passo >= ATERRAMENTO.length) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-saude-verde/40 bg-saude-verde-light/40 p-4">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 size-6 shrink-0 text-saude-verde" aria-hidden />
          <div>
            <h3 className="text-base font-bold text-neutral-900">
              Você chegou ao fim
            </h3>
            <p className="mt-0.5 text-sm text-neutral-700">
              Se ainda estiver difícil, faça de novo ou mande uma mensagem para
              o seu professor. Você não precisa passar por isso sozinho.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPasso(0)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-base font-semibold text-neutral-700"
        >
          <RotateCcw className="size-5" aria-hidden />
          Fazer de novo
        </button>
      </div>
    );
  }

  const atual = ATERRAMENTO[passo];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex gap-1.5" aria-hidden>
        {ATERRAMENTO.map((_, indice) => (
          <span
            key={indice}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              indice <= passo ? "bg-primary" : "bg-neutral-100"
            )}
          />
        ))}
      </div>

      <div aria-live="polite">
        <p className="text-sm text-neutral-500">
          Passo {passo + 1} de {ATERRAMENTO.length}
        </p>
        <h3 className="mt-1 text-2xl font-bold text-neutral-900">
          {atual.titulo}
        </h3>
        <p className="mt-2 text-base text-neutral-600">{atual.instrucao}</p>
      </div>

      <button
        type="button"
        onClick={() => setPasso((p) => p + 1)}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-opacity hover:opacity-90"
      >
        {passo === ATERRAMENTO.length - 1 ? "Terminar" : "Pronto, próximo"}
        <ArrowRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
