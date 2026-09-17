"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { AulaNoDia } from "@/lib/supabase/aulas";
import {
  horaCurta,
  horaFim,
  HORAS_PARA_DESMARCAR,
  traduzirErroAula,
  vagasRestantes,
} from "@/lib/utils/aulas";

/**
 * Um horário do dia, com a vaga e o botão de marcar. A confirmação aparece
 * no próprio cartão: o aluno vê "Você está marcado" sem sair da lista.
 */
export function MarcarAula({
  aula,
  alunoId,
  agoraISO,
}: {
  aula: AulaNoDia;
  alunoId: string;
  /** Instante do servidor, no fuso da academia: evita depender do relógio do celular. */
  agoraISO: string;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [acabouDeMarcar, setAcabouDeMarcar] = useState(false);
  const [, iniciarTransicao] = useTransition();

  const restantes = vagasRestantes(aula.vagas, aula.ocupadas);
  const comeca = new Date(`${aula.data}T${horaCurta(aula.hora)}:00`);
  const agora = new Date(agoraISO);
  const jaPassou = comeca.getTime() <= agora.getTime();
  const horasAteAula = (comeca.getTime() - agora.getTime()) / 3600000;
  const podeDesmarcar = horasAteAula >= HORAS_PARA_DESMARCAR;

  async function marcar() {
    setErro(null);
    setSalvando(true);

    const { error } = await createClient()
      .from("aula_inscricoes")
      .insert({ horario_id: aula.horarioId, aluno_id: alunoId, data: aula.data });

    setSalvando(false);

    if (error) {
      setErro(traduzirErroAula(error.message));
      iniciarTransicao(() => router.refresh());
      return;
    }

    setAcabouDeMarcar(true);
    iniciarTransicao(() => router.refresh());
  }

  async function desmarcar() {
    setErro(null);
    setSalvando(true);

    const { error } = await createClient()
      .from("aula_inscricoes")
      .delete()
      .eq("horario_id", aula.horarioId)
      .eq("aluno_id", alunoId)
      .eq("data", aula.data);

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos desmarcar agora. Tente de novo.");
      return;
    }

    setAcabouDeMarcar(false);
    iniciarTransicao(() => router.refresh());
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 px-4 py-3.5 md:px-5",
        aula.estouInscrito && "bg-neutral-50"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 shrink-0 border-r border-neutral-200/80 pr-3">
          <p className="numero text-[17px] leading-none font-semibold text-neutral-950">
            {horaCurta(aula.hora)}
          </p>
          <p className="rotulo mt-1 text-neutral-400">
            {horaFim(aula.hora, aula.duracaoMin)}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-950">{aula.titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-neutral-500">
            {aula.local && <span>{aula.local}</span>}
            {aula.cancelada ? (
              <span className="font-semibold text-saude-vermelho">
                Aula cancelada{aula.motivoCancelamento ? `: ${aula.motivoCancelamento}` : ""}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5 text-neutral-400" strokeWidth={1.8} aria-hidden />
                {restantes === 0 ? (
                  <span className="font-semibold text-neutral-600">Sem vaga</span>
                ) : (
                  <>
                    <span className="numero font-semibold text-neutral-950">{restantes}</span>
                    {restantes === 1 ? "vaga" : "vagas"} de {aula.vagas}
                  </>
                )}
              </span>
            )}
          </p>
        </div>

        {!aula.cancelada && !jaPassou && (
          <div className="shrink-0">
            {aula.estouInscrito ? (
              <button
                type="button"
                onClick={desmarcar}
                disabled={salvando || !podeDesmarcar}
                title={
                  podeDesmarcar
                    ? "Desmarcar"
                    : `Perto demais do horário: dá para desmarcar até ${HORAS_PARA_DESMARCAR}h antes`
                }
                className="flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-neutral-500 ring-1 ring-neutral-200 transition-colors hover:text-neutral-950 disabled:opacity-40"
              >
                {salvando ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <X className="size-4" aria-hidden />
                )}
                Desmarcar
              </button>
            ) : (
              <button
                type="button"
                onClick={marcar}
                disabled={salvando || restantes === 0}
                className="flex h-10 items-center gap-1.5 rounded-full bg-grafite px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98] disabled:bg-neutral-200 disabled:text-neutral-500"
              >
                {salvando ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {restantes === 0 ? "Lotada" : "Marcar"}
              </button>
            )}
          </div>
        )}
      </div>

      {aula.estouInscrito && (
        <p
          role={acabouDeMarcar ? "status" : undefined}
          className="flex items-center gap-2 text-[13px] font-medium text-saude-verde"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          {acabouDeMarcar
            ? `Pronto! Sua vaga está garantida às ${horaCurta(aula.hora)}.`
            : "Você está marcado nesta aula."}
        </p>
      )}

      {erro && (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-saude-vermelho">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {erro}
        </p>
      )}
    </li>
  );
}
