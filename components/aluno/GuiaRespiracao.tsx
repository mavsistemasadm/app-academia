"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ExercicioRespiracao } from "@/lib/utils/bem-estar";
import { RESPIRACOES } from "@/lib/utils/bem-estar";

/**
 * Onde o exercício está no segundo `decorrido`. Derivar em vez de guardar
 * fase e ciclo em estado evita o vaivém de `setState` dentro de efeito —
 * o relógio só incrementa um número, e o resto é conta.
 */
function posicaoNoExercicio(exercicio: ExercicioRespiracao, decorrido: number) {
  const duracaoDoCiclo = exercicio.fases.reduce((s, f) => s + f.segundos, 0);
  const total = duracaoDoCiclo * exercicio.ciclos;

  if (decorrido >= total) {
    return {
      fase: exercicio.fases.length - 1,
      ciclo: exercicio.ciclos,
      restante: 0,
      terminou: true,
    };
  }

  const ciclo = Math.floor(decorrido / duracaoDoCiclo);
  let dentroDoCiclo = decorrido % duracaoDoCiclo;

  for (let i = 0; i < exercicio.fases.length; i += 1) {
    const duracao = exercicio.fases[i].segundos;

    if (dentroDoCiclo < duracao) {
      return {
        fase: i,
        ciclo,
        restante: duracao - dentroDoCiclo,
        terminou: false,
      };
    }

    dentroDoCiclo -= duracao;
  }

  return { fase: 0, ciclo, restante: 0, terminou: false };
}

export function GuiaRespiracao() {
  const [exercicio, setExercicio] = useState<ExercicioRespiracao>(
    RESPIRACOES[0]
  );
  const [rodando, setRodando] = useState(false);
  const [decorrido, setDecorrido] = useState(0);

  const { fase, ciclo, restante, terminou } = posicaoNoExercicio(
    exercicio,
    decorrido
  );

  function reiniciar(novo: ExercicioRespiracao = exercicio) {
    setExercicio(novo);
    setRodando(false);
    setDecorrido(0);
  }

  // Um relógio só, contando segundos. Para sozinho no fim do último ciclo.
  useEffect(() => {
    if (!rodando || terminou) return;

    const id = setInterval(() => setDecorrido((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rodando, terminou]);

  const faseAtual = exercicio.fases[fase];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {RESPIRACOES.map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            onClick={() => reiniciar(opcao)}
            aria-pressed={opcao.chave === exercicio.chave}
            className={cn(
              "rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
              opcao.chave === exercicio.chave
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {opcao.nome}
          </button>
        ))}
      </div>

      <div>
        <p className="text-sm text-neutral-600">{exercicio.descricao}</p>
        <p className="text-xs text-neutral-500">{exercicio.indicacao}</p>
      </div>

      {/* ── O círculo que respira junto ─────────────────────────── */}
      <div className="flex aspect-square max-h-72 w-full items-center justify-center">
        <div
          className="flex items-center justify-center rounded-full bg-primary/10"
          style={{
            width: `${faseAtual.escala * 100}%`,
            height: `${faseAtual.escala * 100}%`,
            transitionProperty: "width, height",
            transitionDuration: `${faseAtual.segundos}s`,
            transitionTimingFunction: "ease-in-out",
          }}
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <p
              aria-live="polite"
              className="text-lg font-bold text-neutral-900"
            >
              {terminou ? "Pronto" : faseAtual.rotulo}
            </p>
            {!terminou && (
              <p className="text-4xl font-bold text-primary tabular-nums">
                {restante}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-neutral-500">
        {terminou
          ? "Você completou o exercício. Repare como o corpo está agora."
          : `Ciclo ${Math.min(ciclo + 1, exercicio.ciclos)} de ${exercicio.ciclos}`}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => (terminou ? reiniciar() : setRodando((v) => !v))}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-opacity hover:opacity-90"
        >
          {terminou ? (
            <>
              <RotateCcw className="size-5" aria-hidden />
              Fazer de novo
            </>
          ) : rodando ? (
            <>
              <Pause className="size-5" aria-hidden />
              Pausar
            </>
          ) : (
            <>
              <Play className="size-5" aria-hidden />
              Começar
            </>
          )}
        </button>

        {!terminou && (decorrido > 0 || rodando) && (
          <button
            type="button"
            onClick={() => reiniciar()}
            aria-label="Reiniciar exercício"
            className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50"
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
