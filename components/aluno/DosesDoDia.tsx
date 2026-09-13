"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Clock, Pill, X } from "lucide-react";

import type { Dose, SituacaoDose } from "@/lib/supabase/remedios";
import type { MedicamentoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const ESTILO: Record<SituacaoDose, { card: string; texto: string; rotulo: string }> = {
  tomada: {
    card: "border-saude-verde/40 bg-saude-verde-light/40",
    texto: "text-saude-verde",
    rotulo: "Confirmado",
  },
  atrasada: {
    card: "border-saude-amarelo/40 bg-saude-amarelo-light/40",
    texto: "text-saude-amarelo",
    rotulo: "Atrasado",
  },
  pulada: {
    card: "border-saude-vermelho/40 bg-saude-vermelho-light/40",
    texto: "text-saude-vermelho",
    rotulo: "Não tomou",
  },
  adiada: {
    card: "border-neutral-200 bg-white",
    texto: "text-neutral-500",
    rotulo: "Adiado",
  },
  aguardando: {
    card: "border-neutral-200 bg-white",
    texto: "text-neutral-400",
    rotulo: "Mais tarde",
  },
};

interface DosesDoDiaProps {
  alunoId: string;
  doses: Dose[];
  hoje: string;
}

export function DosesDoDia({ alunoId, doses, hoje }: DosesDoDiaProps) {
  const router = useRouter();

  const [estado, setEstado] = useState<Record<string, SituacaoDose>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  function situacaoDe(dose: Dose) {
    return estado[`${dose.medicamentoId}:${dose.horario}`] ?? dose.situacao;
  }

  async function registrar(dose: Dose, status: MedicamentoStatus) {
    const chave = `${dose.medicamentoId}:${dose.horario}`;
    const anterior = situacaoDe(dose);
    const nova: SituacaoDose = status === "tomou" ? "tomada" : "pulada";

    setEstado((atual) => ({ ...atual, [chave]: nova }));
    setErro(null);

    const { error } = await createClient()
      .from("medicamento_confirmacoes")
      .upsert(
        {
          medicamento_id: dose.medicamentoId,
          aluno_id: alunoId,
          data: hoje,
          horario: dose.horario,
          data_hora: new Date().toISOString(),
          status,
        },
        { onConflict: "medicamento_id,data,horario" }
      );

    if (error) {
      setEstado((atual) => ({ ...atual, [chave]: anterior }));
      setErro("Não conseguimos registrar. Verifique sua conexão.");
      return;
    }

    iniciarTransicao(() => router.refresh());
  }

  if (doses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <Pill className="size-5" aria-hidden />
        </span>
        <p className="text-base font-semibold text-neutral-900">
          Nenhum remédio para hoje
        </p>
        <p className="max-w-xs text-sm text-neutral-500">
          Cadastre seus medicamentos e o app lembra você em cada horário.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-saude-vermelho-light px-3.5 py-3 text-sm text-saude-vermelho"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {doses.map((dose) => {
          const situacao = situacaoDe(dose);
          const estilo = ESTILO[situacao];
          const resolvida = situacao === "tomada" || situacao === "pulada";

          return (
            <li
              key={`${dose.medicamentoId}:${dose.horario}`}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
                estilo.card
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Pill className="size-5" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-neutral-900">
                    {dose.nome}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-neutral-500">
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    {dose.horario}
                    {dose.dose && ` · ${dose.dose}`}
                  </p>
                </div>

                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold",
                    estilo.texto
                  )}
                >
                  {estilo.rotulo}
                </span>
              </div>

              {!resolvida && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => registrar(dose, "tomou")}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-saude-verde text-base font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <Check className="size-5" aria-hidden />
                    Tomei
                  </button>
                  <button
                    type="button"
                    onClick={() => registrar(dose, "nao_tomou")}
                    aria-label={`Não tomei ${dose.nome} das ${dose.horario}`}
                    className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-400 transition-colors hover:bg-neutral-50"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
              )}

              {situacao === "pulada" && (
                <button
                  type="button"
                  onClick={() => registrar(dose, "tomou")}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Tomei agora, corrigir
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
