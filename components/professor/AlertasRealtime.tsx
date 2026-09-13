"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";

import type { AlertaProfessor, AlertaTipo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const ESTILO: Record<AlertaTipo, { cor: string; rotulo: string }> = {
  indicador_vermelho: {
    cor: "border-saude-vermelho/40 bg-saude-vermelho-light/50",
    rotulo: "Indicador crítico",
  },
  humor_ruim: {
    cor: "border-saude-amarelo/40 bg-saude-amarelo-light/50",
    rotulo: "Humor",
  },
  remedio_nao_tomado: {
    cor: "border-saude-amarelo/40 bg-saude-amarelo-light/50",
    rotulo: "Medicamento",
  },
  sem_treinar: {
    cor: "border-neutral-200 bg-white",
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
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-saude-verde-light text-saude-verde">
          <BellOff className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            Nenhum alerta aberto
          </p>
          <p className="text-xs text-neutral-500">
            Indicadores críticos aparecem aqui na hora em que o aluno registra.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-live="polite">
      {alertas.map((alerta) => {
        const estilo = ESTILO[alerta.tipo] ?? ESTILO.sem_treinar;
        const detalhe = detalhar(alerta);

        return (
          <li
            key={alerta.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              estilo.cor
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-neutral-600">
              <Bell className="size-4" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-neutral-900">
                {alerta.aluno ? (
                  <Link
                    href={`/alunos/${alerta.aluno_id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {alerta.aluno.nome}
                  </Link>
                ) : (
                  "Aluno"
                )}
                <span className="text-xs font-medium text-neutral-500">
                  {estilo.rotulo}
                </span>
              </p>

              <p className="mt-0.5 text-sm text-neutral-700">
                {alerta.mensagem}
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                {detalhe && <span className="font-medium">{detalhe} · </span>}
                {formatDistanceToNow(new Date(alerta.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            </div>

            <button
              type="button"
              onClick={() => resolver(alerta.id)}
              disabled={resolvendo === alerta.id}
              aria-label="Marcar alerta como resolvido"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-neutral-500 transition-colors hover:bg-white hover:text-saude-verde"
            >
              {resolvendo === alerta.id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
