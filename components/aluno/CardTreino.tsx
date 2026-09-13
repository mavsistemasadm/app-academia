import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { TreinoHoje } from "@/lib/supabase/home-aluno";

interface CardTreinoProps {
  treino: TreinoHoje | null;
}

/** Anel de progresso em SVG — séries feitas sobre o total do dia. */
function Anel({ progresso, rotulo }: { progresso: number; rotulo: string }) {
  const raio = 23;
  const circunferencia = 2 * Math.PI * raio;

  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={raio} fill="none" stroke="var(--color-neutral-200)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={raio}
          fill="none"
          stroke="var(--ciano)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - progresso / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="numero absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-neutral-950">
        {rotulo}
      </span>
    </div>
  );
}

export function CardTreino({ treino }: CardTreinoProps) {
  if (!treino) {
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90">
        <p className="rotulo text-neutral-400">Treino de hoje</p>
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
          Dia sem treino marcado
        </h3>
        <p className="text-sm leading-relaxed text-neutral-500">
          Seu professor ainda não montou um treino para este dia da semana.
          Descanso também conta.
        </p>
      </div>
    );
  }

  const progresso = treino.concluido
    ? 100
    : treino.totalSeries > 0
      ? Math.round((treino.seriesFeitas / treino.totalSeries) * 100)
      : 0;

  const rotuloBotao = treino.concluido
    ? "Ver treino"
    : treino.seriesFeitas > 0
      ? "Continuar"
      : "Começar";

  const legenda = treino.concluido
    ? "Concluído hoje"
    : treino.seriesFeitas > 0
      ? `${treino.seriesFeitas} de ${treino.totalSeries} séries`
      : `${treino.totalExercicios} ${treino.totalExercicios === 1 ? "exercício" : "exercícios"} · ${treino.totalSeries} séries`;

  return (
    <div className="flex h-full flex-col justify-between gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo text-neutral-400">Treino de hoje</p>
          <h3 className="mt-1.5 text-lg leading-snug font-semibold tracking-[-0.02em] text-neutral-950">
            {treino.nome}
          </h3>
          <p className="mt-0.5 text-sm text-neutral-500">{legenda}</p>
        </div>
        <Anel progresso={progresso} rotulo={treino.concluido ? "✓" : `${progresso}%`} />
      </div>

      <Link
        href="/treino"
        className="group flex h-12 items-center justify-between rounded-full bg-grafite pr-2 pl-5 text-[15px] font-semibold text-white transition-colors hover:bg-neutral-800"
      >
        {rotuloBotao}
        <span className="flex size-9 items-center justify-center rounded-full bg-ciano text-grafite">
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </div>
  );
}
