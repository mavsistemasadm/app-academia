"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCircle2, Loader2 } from "lucide-react";

import type { AlertaProfessor, AlertaTipo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

/*
  Severidade à esquerda, tipo no chip. Vermelho só para indicador crítico —
  é o que exige ação na hora; humor e remédio são amarelo; frequência, neutro.
*/
const ESTILO: Record<AlertaTipo, { faixa: string; chip: string; rotulo: string }> = {
  indicador_vermelho: {
    faixa: "bg-saude-vermelho",
    chip: "bg-saude-vermelho-light text-[#b91c1c]",
    rotulo: "Indicador crítico",
  },
  humor_ruim: {
    faixa: "bg-saude-amarelo",
    chip: "bg-saude-amarelo-light text-[#b45309]",
    rotulo: "Humor",
  },
  remedio_nao_tomado: {
    faixa: "bg-saude-amarelo",
    chip: "bg-saude-amarelo-light text-[#b45309]",
    rotulo: "Medicamento",
  },
  sem_treinar: {
    faixa: "bg-neutral-300",
    chip: "bg-neutral-100 text-neutral-600",
    rotulo: "Frequência",
  },
};

/** Detalhe legível do que veio no `dados` jsonb do alerta. */
function detalhar(alerta: AlertaProfessor): string | null {
  const dados = alerta.dados as Record<string, unknown> | undefined;
  if (!dados) return null;

  if (alerta.tipo === "indicador_vermelho") {
    const partes = [dados.tipo, dados.valor].filter(Boolean);
    if (partes.length === 0) return null;

    const valor = dados.valor2
      ? `${dados.valor}/${dados.valor2}`
      : String(dados.valor);

    return `${dados.tipo}: ${valor}`;
  }

  return null;
}

interface AlertasRealtimeProps {
  professorId: string;
  alertasIniciais: AlertaProfessor[];
}

export function AlertasRealtime({
  professorId,
  alertasIniciais,
}: AlertasRealtimeProps) {
  const router = useRouter();

  /*
    A prop do servidor é a fonte da verdade. O estado local guarda só o que
    ela ainda não sabe: os alertas que chegaram pelo realtime desde o último
    render e os que o professor acabou de resolver. Assim nada precisa ser
    "sincronizado" num efeito — a lista é derivada dos três.
  */
  const [recebidos, setRecebidos] = useState<AlertaProfessor[]>([]);
  const [resolvidos, setResolvidos] = useState<string[]>([]);
  const [resolvendo, setResolvendo] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  const alertas = useMemo(() => {
    const doServidor = new Set(alertasIniciais.map((a) => a.id));
    const fechados = new Set(resolvidos);

    return [
      ...recebidos.filter((a) => !doServidor.has(a.id)),
      ...alertasIniciais,
    ].filter((a) => !fechados.has(a.id));
  }, [alertasIniciais, recebidos, resolvidos]);

  useEffect(() => {
    const supabase = createClient();

    const canal = supabase
      .channel(`alertas_professor:${professorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alertas_professor",
          filter: `professor_id=eq.${professorId}`,
        },
        async ({ new: novo }) => {
          const alerta = novo as AlertaProfessor;

          // O payload do realtime não traz o join; busca o nome do aluno.
          const { data: aluno } = await supabase
            .from("profiles")
            .select("id, nome, foto_url")
            .eq("id", alerta.aluno_id)
            .maybeSingle();

          setRecebidos((atuais) =>
            atuais.some((a) => a.id === alerta.id)
              ? atuais
              : [{ ...alerta, aluno: aluno ?? undefined }, ...atuais]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [professorId]);

  async function resolver(id: string) {
    setResolvendo(id);

    const { error } = await createClient()
      .from("alertas_professor")
      .update({ resolvido: true })
      .eq("id", id);

    setResolvendo(null);

    if (error) return;

    setResolvidos((atuais) => [...atuais, id]);
    iniciarTransicao(() => router.refresh());
  }

  if (alertas.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-card px-5 py-5 ring-1 ring-neutral-200/90">
        <CheckCircle2
          className="mt-0.5 size-5 shrink-0 text-saude-verde"
          strokeWidth={1.8}
          aria-hidden
        />
        <div>
          <p className="text-[15px] font-semibold text-neutral-950">
            Nenhum alerta aberto
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-neutral-500">
            Indicadores críticos e humor ruim aparecem aqui no momento em que o
            aluno registra.
          </p>
        </div>
      </div>
    );
  }

  const criticos = alertas.filter((a) => a.tipo === "indicador_vermelho").length;

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200/80 px-4 py-3 md:px-5">
        <p className="rotulo flex items-center gap-2 text-neutral-400">
          <span aria-hidden className="size-1.5 rounded-full bg-ciano" />
          Tempo real
        </p>
        <p className="text-[13px] text-neutral-500">
          <span className="numero font-semibold text-neutral-950">{alertas.length}</span>{" "}
          {alertas.length === 1 ? "aberto" : "abertos"}
          {criticos > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-saude-vermelho">
                {criticos} {criticos === 1 ? "crítico" : "críticos"}
              </span>
            </>
          )}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-neutral-200/80" aria-live="polite">
        {alertas.map((alerta) => {
          const estilo = ESTILO[alerta.tipo] ?? ESTILO.sem_treinar;
          const detalhe = detalhar(alerta);

          return (
            <li key={alerta.id} className="flex items-stretch gap-3 px-4 py-3.5 md:px-5">
              <span
                aria-hidden
                className={cn("w-1 shrink-0 self-stretch rounded-full", estilo.faixa)}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {alerta.aluno ? (
                    <Link
                      href={`/alunos/${alerta.aluno_id}`}
                      className="text-[15px] font-semibold text-neutral-950 underline-offset-4 hover:underline"
                    >
                      {alerta.aluno.nome}
                    </Link>
                  ) : (
                    <span className="text-[15px] font-semibold text-neutral-950">Aluno</span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      estilo.chip
                    )}
                  >
                    {estilo.rotulo}
                  </span>
                </div>

                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  {alerta.mensagem}
                </p>

                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {detalhe && (
                    <span className="numero text-sm font-semibold text-neutral-950 first-letter:uppercase">
                      {detalhe}
                    </span>
                  )}
                  <span className="rotulo text-neutral-400">
                    {formatDistanceToNow(new Date(alerta.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => resolver(alerta.id)}
                disabled={resolvendo === alerta.id}
                aria-label="Marcar alerta como resolvido"
                title="Marcar como resolvido"
                className="flex size-10 shrink-0 items-center justify-center self-center rounded-full text-neutral-500 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-saude-verde-light hover:text-saude-verde hover:ring-transparent active:scale-[.96] disabled:opacity-60"
              >
                {resolvendo === alerta.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-[18px]" strokeWidth={2} aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
