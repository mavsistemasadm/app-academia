"use client";

import { useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { ATERRAMENTO } from "@/lib/utils/bem-estar";

/** Painel escuro com brilho ciano — o mesmo chão da respiração guiada. */
function Painel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col gap-5 overflow-hidden rounded-[26px] bg-grafite p-5 text-white md:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-28 size-80 rounded-full bg-[radial-gradient(circle,rgba(0,180,203,.2),transparent_65%)]"
      />
      {children}
    </div>
  );
}

const BOTAO_CIANO =
  "relative flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ciano text-[15px] font-semibold text-grafite transition-all duration-200 hover:bg-[#2cc4d8] active:scale-[.98]";

/**
 * Técnica 5-4-3-2-1. Um passo por vez, de propósito: em crise de ansiedade
 * uma lista inteira na tela é mais uma coisa para dar conta.
 */
export function GuiaAterramento() {
  const [passo, setPasso] = useState(-1);

  if (passo === -1) {
    return (
      <Painel>
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="rotulo text-[#5fd3e2]">Aterramento 5-4-3-2-1</p>
            <h3 className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.025em]">
              Estou ansioso agora
            </h3>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/65">
              Cinco passos curtos para trazer sua atenção de volta ao corpo.
              Leva uns dois minutos.
            </p>
          </div>
        </div>

        <button type="button" onClick={() => setPasso(0)} className={BOTAO_CIANO}>
          Começar
          <ArrowRight className="size-5" aria-hidden />
        </button>
      </Painel>
    );
  }

  if (passo >= ATERRAMENTO.length) {
    return (
      <Painel>
        <div className="relative flex items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ciano text-grafite">
            <Check className="size-5" strokeWidth={2.4} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[22px] leading-tight font-semibold tracking-[-0.025em]">
              Você chegou ao fim
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-white/65">
              Se ainda estiver difícil, faça de novo ou mande uma mensagem para
              o seu professor. Você não precisa passar por isso sozinho.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPasso(0)}
          className="relative flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/[.06] text-[15px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/10"
        >
          <RotateCcw className="size-5" aria-hidden />
          Fazer de novo
        </button>
      </Painel>
    );
  }

  const atual = ATERRAMENTO[passo];

  return (
    <Painel>
      <div className="relative flex gap-1.5" aria-hidden>
        {ATERRAMENTO.map((_, indice) => (
          <span
            key={indice}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200",
              indice <= passo ? "bg-ciano" : "bg-white/10"
            )}
          />
        ))}
      </div>

      <div aria-live="polite" className="relative flex items-start gap-5">
        <span className="numero shrink-0 text-[64px] leading-[.85] font-semibold text-ciano">
          {atual.quantidade}
        </span>
        <div className="min-w-0">
          <p className="rotulo text-white/45">
            Passo {passo + 1} de {ATERRAMENTO.length}
          </p>
          <h3 className="mt-1.5 text-[22px] leading-tight font-semibold tracking-[-0.025em]">
            {atual.titulo}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-white/70">
            {atual.instrucao}
          </p>
        </div>
      </div>

      <button type="button" onClick={() => setPasso((p) => p + 1)} className={BOTAO_CIANO}>
        {passo === ATERRAMENTO.length - 1 ? "Terminar" : "Pronto, próximo"}
        <ArrowRight className="size-5" aria-hidden />
      </button>
    </Painel>
  );
}
