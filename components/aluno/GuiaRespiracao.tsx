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
  /*
    Parado, o círculo descansa pequeno; em andamento segue a escala da fase.
    A fase nunca depende só do movimento: o texto e a contagem dizem tudo.
  */
  const escala = rodando || decorrido > 0 ? faseAtual.escala : 0.45;

  return (
    <div className="relative flex flex-col gap-5 overflow-hidden rounded-[26px] bg-grafite p-5 text-white md:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 left-1/2 size-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,180,203,.22),transparent_65%)]"
      />

      {/* ── Ritmos ──────────────────────────────────────────────── */}
      <div className="relative flex flex-wrap gap-2" role="group" aria-label="Ritmo de respiração">
        {RESPIRACOES.map((opcao) => {
          const ativo = opcao.chave === exercicio.chave;
          return (
            <button
              key={opcao.chave}
              type="button"
              onClick={() => reiniciar(opcao)}
              aria-pressed={ativo}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                ativo
                  ? "bg-white text-grafite"
                  : "bg-white/[.06] text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
              )}
            >
              {opcao.nome}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <p className="text-[15px] leading-relaxed text-white/80">{exercicio.descricao}</p>
        <p className="mt-0.5 text-sm text-white/50">{exercicio.indicacao}</p>
      </div>

      {/* ── O círculo que respira junto ─────────────────────────── */}
      <div className="relative mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center">
        <span aria-hidden className="absolute inset-0 rounded-full ring-1 ring-white/10" />
        <span aria-hidden className="absolute inset-[27.5%] rounded-full ring-1 ring-white/[.06]" />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,180,203,.55)_0%,rgba(0,180,203,.22)_55%,rgba(0,180,203,.08)_100%)] shadow-[0_0_60px_-10px_rgba(0,180,203,.6)] ring-1 ring-ciano/50"
          style={{
            transform: `scale(${escala})`,
            transitionProperty: "transform",
            transitionDuration: `${faseAtual.segundos}s`,
            transitionTimingFunction: "ease-in-out",
          }}
        />

        <div className="relative flex flex-col items-center gap-1.5 px-6 text-center">
          <p aria-live="polite" className="text-lg leading-tight font-semibold tracking-[-0.02em] text-white">
            {terminou ? "Pronto" : faseAtual.rotulo}
          </p>
          {!terminou && (
            <p className="numero text-[56px] leading-none font-semibold text-white">
              {restante}
            </p>
          )}
        </div>
      </div>

      <p className="rotulo relative text-center text-white/50">
        {terminou
          ? "Exercício completo"
          : `Ciclo ${Math.min(ciclo + 1, exercicio.ciclos)} de ${exercicio.ciclos}`}
      </p>
      {terminou && (
        <p className="relative -mt-3 text-center text-[15px] text-white/70">
          Repare como o corpo está agora.
        </p>
      )}

      <div className="relative flex gap-2">
        <button
          type="button"
          onClick={() => (terminou ? reiniciar() : setRodando((v) => !v))}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ciano text-[15px] font-semibold text-grafite transition-all duration-200 hover:bg-[#2cc4d8] active:scale-[.98]"
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
              {decorrido > 0 ? "Continuar" : "Começar"}
            </>
          )}
        </button>

        {!terminou && (decorrido > 0 || rodando) && (
          <button
            type="button"
            onClick={() => reiniciar()}
            aria-label="Reiniciar exercício"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/[.06] text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
