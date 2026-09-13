"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Droplets, Loader2, Undo2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

/** Os três recipientes que existem na academia. */
const PORCOES = [
  { ml: 200, label: "Copo", emoji: "🥛" },
  { ml: 500, label: "Garrafa", emoji: "🍶" },
  { ml: 1000, label: "Litro", emoji: "🫗" },
];

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
      setErro("Não conseguimos registrar. Tente de novo.");
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
      setErro("Não conseguimos desfazer.");
      return;
    }

    setTotal((atual) => atual - ultimo.quantidadeMl);
    setLista((atuais) => atuais.slice(1));
    iniciarTransicao(() => router.refresh());
  }

  const proporcao = Math.min(100, Math.round((total / metaMl) * 100));
  const bateu = total >= metaMl;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl leading-tight font-bold text-neutral-900 tabular-nums">
            {(total / 1000).toFixed(1).replace(".", ",")} L
          </p>
          <p className="text-sm text-neutral-500">
            de {(metaMl / 1000).toFixed(1).replace(".", ",")} L hoje
          </p>
        </div>

        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
            bateu
              ? "bg-saude-verde-light text-saude-verde"
              : "bg-blue-50 text-primary"
          }`}
        >
          {bateu ? "Meta batida" : `${proporcao}%`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={proporcao}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da meta de água de hoje"
        className="h-3 overflow-hidden rounded-full bg-neutral-100"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            bateu ? "bg-saude-verde" : "bg-primary"
          }`}
          style={{ width: `${proporcao}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PORCOES.map(({ ml, label, emoji }) => (
          <button
            key={ml}
            type="button"
            onClick={() => beber(ml)}
            disabled={salvando}
            className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl border border-neutral-200 bg-white transition-colors hover:bg-blue-50 disabled:opacity-60"
          >
            <span className="text-2xl leading-none" aria-hidden>
              {emoji}
            </span>
            <span className="text-sm font-semibold text-neutral-900">
              {label}
            </span>
            <span className="text-xs text-neutral-500">{ml} ml</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Droplets className="size-3.5" aria-hidden />
          {lista.length}{" "}
          {lista.length === 1 ? "registro hoje" : "registros hoje"}
          {lista[0] && ` · último às ${format(new Date(lista[0].hora), "HH:mm")}`}
        </p>

        {lista.length > 0 && (
          <button
            type="button"
            onClick={desfazer}
            disabled={salvando}
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 underline-offset-4 hover:underline"
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
