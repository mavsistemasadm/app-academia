"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pill, X } from "lucide-react";

import type { Dose, SituacaoDose } from "@/lib/supabase/remedios";
import type { MedicamentoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const ESTILO: Record<SituacaoDose, { ponto: string; texto: string; rotulo: string }> = {
  tomada: {
    ponto: "",
    texto: "text-primary",
    rotulo: "Tomada",
  },
  atrasada: {
    ponto: "bg-saude-amarelo",
    texto: "text-[#b45309]",
    rotulo: "Atrasada",
  },
  pulada: {
    ponto: "bg-saude-vermelho",
    texto: "text-[#b91c1c]",
    rotulo: "Não tomou",
  },
  adiada: {
    ponto: "bg-neutral-300",
    texto: "text-neutral-500",
    rotulo: "Adiada",
  },
  aguardando: {
    ponto: "bg-neutral-300",
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
      setErro("Não conseguimos registrar. Verifique sua conexão e tente de novo.");
      return;
    }

    iniciarTransicao(() => router.refresh());
  }

  if (doses.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1.5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90">
        <Pill className="size-5 text-neutral-400" strokeWidth={1.8} aria-hidden />
        <p className="mt-1.5 text-[15px] font-semibold text-neutral-950">
          Nenhuma dose para hoje
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
          Cadastre seus medicamentos logo abaixo e o app lembra você em cada
          horário.
        </p>
      </div>
    );
  }

  /*
    Um destaque só: a primeira dose atrasada ou, se não houver, a próxima.
    As outras pendentes continuam confirmáveis num toque, só que sem cor.
  */
  const destaque =
    doses.find((d) => situacaoDe(d) === "atrasada") ??
    doses.find((d) => {
      const s = situacaoDe(d);
      return s === "aguardando" || s === "adiada";
    });
  const chaveDestaque = destaque
    ? `${destaque.medicamentoId}:${destaque.horario}`
    : null;

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
        {doses.map((dose) => {
          const chave = `${dose.medicamentoId}:${dose.horario}`;
          const situacao = situacaoDe(dose);
          const estilo = ESTILO[situacao];
          const resolvida = situacao === "tomada" || situacao === "pulada";
          const emDestaque = chave === chaveDestaque;

          return (
            <li
              key={chave}
              className={cn(
                "flex flex-col gap-3 px-4 py-4 transition-colors duration-200 md:px-5",
                emDestaque && situacao === "atrasada" && "bg-saude-amarelo-light/40"
              )}
            >
              <div className="flex items-center gap-3.5">
                <p
                  className={cn(
                    "numero w-[4.75rem] shrink-0 leading-none font-semibold",
                    emDestaque ? "text-[28px]" : "text-2xl",
                    situacao === "tomada" ? "text-neutral-400" : "text-neutral-950"
                  )}
                >
                  {dose.horario}
                </p>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[15px] font-semibold",
                      situacao === "tomada" ? "text-neutral-500" : "text-neutral-950"
                    )}
                  >
                    {dose.nome}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px]">
                    {situacao === "tomada" ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-ciano text-white">
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                      </span>
                    ) : (
                      <span className={cn("size-2 shrink-0 rounded-full", estilo.ponto)} />
                    )}
                    <span className={cn("font-medium", estilo.texto)}>
                      {emDestaque && situacao !== "atrasada" ? "Próxima dose" : estilo.rotulo}
                    </span>
                    {dose.dose && (
                      <span className="truncate text-neutral-400">· {dose.dose}</span>
                    )}
                  </p>
                </div>
              </div>

              {!resolvida && (
                <div className="flex gap-2 pl-0 sm:pl-[5.625rem]">
                  <button
                    type="button"
                    onClick={() => registrar(dose, "tomou")}
                    className={cn(
                      "flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-all duration-200 active:scale-[.98]",
                      emDestaque
                        ? "bg-primary text-white hover:bg-[#0b7f91]"
                        : "bg-neutral-50 text-neutral-950 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    )}
                  >
                    <Check className="size-5" aria-hidden />
                    Tomei
                  </button>
                  <button
                    type="button"
                    onClick={() => registrar(dose, "nao_tomou")}
                    aria-label={`Não tomei ${dose.nome} das ${dose.horario}`}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-neutral-400 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-50 hover:text-neutral-600 active:scale-[.98]"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
              )}

              {situacao === "pulada" && (
                <button
                  type="button"
                  onClick={() => registrar(dose, "tomou")}
                  className="self-start text-sm font-semibold text-primary underline-offset-4 hover:underline sm:ml-[5.625rem]"
                >
                  Tomei agora, corrigir →
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
