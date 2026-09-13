import Link from "next/link";
import { Dumbbell } from "lucide-react";

import type { TreinoHoje } from "@/lib/supabase/home-aluno";
import { Button } from "@/components/ui/button";

interface CardTreinoProps {
  treino: TreinoHoje | null;
}

export function CardTreino({ treino }: CardTreinoProps) {
  if (!treino) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center">
        <Dumbbell className="size-6 text-neutral-300" aria-hidden />
        <p className="text-sm font-semibold text-neutral-900">
          Nenhum treino para hoje
        </p>
        <p className="text-sm text-neutral-500">
          Seu professor ainda não montou um treino para este dia da semana.
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
      : "Iniciar";

  const legenda = treino.concluido
    ? "Treino concluído hoje"
    : treino.seriesFeitas > 0
      ? `${treino.seriesFeitas} de ${treino.totalSeries} séries`
      : `${treino.totalExercicios} ${treino.totalExercicios === 1 ? "exercício" : "exercícios"}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-neutral-900">
            {treino.nome}
          </h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            {treino.totalExercicios}{" "}
            {treino.totalExercicios === 1 ? "exercício" : "exercícios"}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
          Hoje
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={progresso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do treino de hoje"
        className="h-2 overflow-hidden rounded-full bg-neutral-100"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progresso}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">{legenda}</p>
        <Button
          render={<Link href="/treino" />}
          // O elemento é um <a> de verdade: sem isso a Base UI reclama
          // que perdeu a semântica nativa de <button>.
          nativeButton={false}
          className="h-10 shrink-0 rounded-xl px-4 font-semibold"
        >
          {rotuloBotao}
        </Button>
      </div>
    </div>
  );
}
