"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, Loader2, Undo2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { naAcademia } from "@/lib/utils/datas";

/** Os três recipientes que existem na academia. */
const PORCOES = [
  { ml: 200, label: "Copo", emoji: "🥛" },
  { ml: 500, label: "Garrafa", emoji: "🍶" },
  { ml: 1000, label: "Litro", emoji: "🫗" },
];

/** Raio do anel em unidades do viewBox (120×120). */
const RAIO = 52;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

function litros(ml: number) {
  return (ml / 1000).toFixed(1).replace(".", ",");
}

interface RegistroHidratacaoProps {
  alunoId: string;
  hoje: string;
  metaMl: number;
  hojeMl: number;
  registros: { id: string; quantidadeMl: number; hora: string }[];
}

export function RegistroHidratacao({
  alunoId,
  hoje,
  metaMl,
  hojeMl,
  registros,
}: RegistroHidratacaoProps) {
  const router = useRouter();
  const [total, setTotal] = useState(hojeMl);
  const [lista, setLista] = useState(registros);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  async function beber(ml: number) {
    setSalvando(true);
    setErro(null);
    setTotal((atual) => atual + ml);

    const { data, error } = await createClient()
      .from("hidratacao_registros")
      .insert({ aluno_id: alunoId, data: hoje, quantidade_ml: ml })
      .select("id, quantidade_ml, created_at")
      .single();

    setSalvando(false);

    if (error || !data) {
      setTotal((atual) => atual - ml);
      setErro("Não conseguimos registrar. Verifique a conexão e tente de novo.");
      return;
    }

    setLista((atuais) => [
      { id: data.id, quantidadeMl: data.quantidade_ml, hora: data.created_at },
      ...atuais,
    ]);
    iniciarTransicao(() => router.refresh());
  }

  async function desfazer() {
    const ultimo = lista[0];
    if (!ultimo) return;

    setSalvando(true);
    setErro(null);

    const { error } = await createClient()
      .from("hidratacao_registros")
      .delete()
      .eq("id", ultimo.id);

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos desfazer. Tente de novo em instantes.");
      return;
    }

    setTotal((atual) => atual - ultimo.quantidadeMl);
    setLista((atuais) => atuais.slice(1));
    iniciarTransicao(() => router.refresh());
  }

  const proporcao = Math.min(100, Math.round((total / metaMl) * 100));
  const bateu = total >= metaMl;

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6">
      <div className="flex items-center gap-5">
        <div
          role="progressbar"
          aria-valuenow={proporcao}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso da meta de água de hoje"
          className="relative size-32 shrink-0 md:size-36"
        >
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r={RAIO}
              fill="none"
              strokeWidth="10"
              className="stroke-neutral-100"
            />
            <circle
              cx="60"
              cy="60"
              r={RAIO}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className="stroke-ciano transition-[stroke-dashoffset] duration-300"
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - proporcao / 100)}
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            {bateu ? (
              <Check className="size-8 text-primary" strokeWidth={2.4} aria-hidden />
            ) : (
              <span className="numero text-[28px] leading-none font-semibold text-neutral-950">
                {proporcao}
                <span className="ml-0.5 font-sans text-xs font-medium tracking-normal text-neutral-400">
                  %
                </span>
              </span>
            )}
          </span>
        </div>

        <div className="min-w-0">
          <p className="rotulo text-neutral-400">Hoje</p>
          <p className="numero mt-1.5 text-[28px] leading-none font-semibold text-neutral-950 md:text-[32px]">
            {litros(total)}
            <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
              de {litros(metaMl)} L
            </span>
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            {bateu
              ? "Meta batida. Pode seguir bebendo aos poucos."
              : `Faltam ${litros(metaMl - total)} L para a meta.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PORCOES.map(({ ml, label, emoji }) => (
          <button
            key={ml}
            type="button"
            onClick={() => beber(ml)}
            disabled={salvando}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-neutral-50 ring-1 ring-neutral-200/90 transition-all duration-200 hover:bg-neutral-100 active:scale-[.98] disabled:opacity-60"
          >
            <span className="text-2xl leading-none" aria-hidden>
              {emoji}
            </span>
            <span className="text-[15px] font-semibold text-neutral-950">
              {label}
            </span>
            <span className="rotulo text-neutral-400">{ml} ml</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-200/80 pt-4">
        <p className="text-[13px] text-neutral-500">
          {lista.length === 0
            ? "Nenhum copo ainda hoje. Comece pelo primeiro."
            : `${lista.length} ${lista.length === 1 ? "registro" : "registros"} hoje`}
          {lista[0] && (
            <span className="text-neutral-400">
              {" · último às "}
              <span className="numero">{format(naAcademia(lista[0].hora), "HH:mm")}</span>
            </span>
          )}
        </p>

        {lista.length > 0 && (
          <button
            type="button"
            onClick={desfazer}
            disabled={salvando}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-neutral-600 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50",
              salvando && "opacity-60"
            )}
          >
            {salvando ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="size-3.5" aria-hidden />
            )}
            Desfazer
          </button>
        )}
      </div>

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}
    </div>
  );
}
