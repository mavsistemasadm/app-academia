"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCircle2, Loader2, MessageCircle } from "lucide-react";

import type { AlertaProfessor, AlertaTipo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";

/*
  Severidade à esquerda, tipo no chip. Vermelho só para indicador crítico —
  é o que exige ação na hora; humor e medicamento são amarelo; frequência, neutro.
*/
const ESTILO: Record<
  AlertaTipo,
  { faixa: string; chip: string; rotulo: string }
> = {
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
  medicamento_nao_tomado: {
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
    const valor = valorDoIndicador(dados);
    if (!valor) return null;

    return `${rotuloDoIndicador(dados)}: ${valor}`;
  }

  return null;
}

/** O gatilho grava a chave crua ("pressao"); o rótulo bonito mora no app. */
function rotuloDoIndicador(dados: Record<string, unknown>): string {
  const tipo = String(dados.tipo ?? "");
  return tipo in CONFIG_INDICADORES
    ? CONFIG_INDICADORES[tipo as keyof typeof CONFIG_INDICADORES].labelCurto
    : tipo;
}

function valorDoIndicador(dados: Record<string, unknown>): string | null {
  if (!dados.valor) return null;
  const valor = dados.valor2
    ? `${dados.valor}/${dados.valor2}`
    : String(dados.valor);
  const unidade =
    String(dados.tipo ?? "") in CONFIG_INDICADORES
      ? CONFIG_INDICADORES[
          String(dados.tipo) as keyof typeof CONFIG_INDICADORES
        ].unidade
      : "";
  return unidade ? `${valor} ${unidade}` : valor;
}

/**
 * A conversa já abre escrita: o professor lê o alerta e fala com o aluno sem
 * ter que lembrar do número nem digitar do zero.
 */
function rascunhoDoAlerta(alerta: AlertaProfessor): string {
  const primeiro = alerta.aluno?.nome?.split(" ")[0] ?? "";
  const oi = primeiro ? `Oi, ${primeiro}!` : "Oi!";
  const dados = (alerta.dados as Record<string, unknown> | undefined) ?? {};

  if (alerta.tipo === "indicador_vermelho") {
    const valor = valorDoIndicador(dados);
    const rotulo = rotuloDoIndicador(dados).toLowerCase();
    return valor
      ? `${oi} Vi aqui o registro de ${rotulo} em ${valor}. Como você está se sentindo agora?`
      : `${oi} Vi um indicador fora da faixa no seu registro. Como você está se sentindo agora?`;
  }
  if (alerta.tipo === "humor_ruim") {
    return `${oi} Vi seu registro de humor de hoje. Quer me contar como está sendo o dia?`;
  }
  if (alerta.tipo === "medicamento_nao_tomado") {
    return `${oi} Passando para lembrar do medicamento de hoje. Conseguiu tomar?`;
  }
  return `${oi} Faz alguns dias que você não aparece por aqui. Está tudo bem?`;
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
              : [{ ...alerta, aluno: aluno ?? undefined }, ...atuais],
          );
        },
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

  const criticos = alertas.filter(
    (a) => a.tipo === "indicador_vermelho",
  ).length;

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200/80 px-4 py-3 md:px-5">
        <p className="rotulo flex items-center gap-2 text-neutral-400">
          <span aria-hidden className="size-1.5 rounded-full bg-ciano" />
          Tempo real
        </p>
        <p className="text-[13px] text-neutral-500">
          <span className="numero font-semibold text-neutral-950">
            {alertas.length}
          </span>{" "}
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

      <ul
        className="flex flex-col divide-y divide-neutral-200/80"
        aria-live="polite"
      >
        {alertas.map((alerta) => {
          const estilo = ESTILO[alerta.tipo] ?? ESTILO.sem_treinar;
          const detalhe = detalhar(alerta);

          return (
            <li
              key={alerta.id}
              className="flex items-stretch gap-2.5 px-4 py-3.5 md:px-5"
            >
              <span
                aria-hidden
                className={cn(
                  "w-1 shrink-0 self-stretch rounded-full",
                  estilo.faixa,
                )}
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
                    <span className="text-[15px] font-semibold text-neutral-950">
                      Aluno
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      estilo.chip,
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
                  {/* "há 38 minutos" pode virar "há 39" entre o servidor e o navegador. */}
                  <span
                    className="rotulo text-neutral-400"
                    suppressHydrationWarning
                  >
                    {formatDistanceToNow(new Date(alerta.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </p>
              </div>

              {/* O alerta pode ser do próprio professor (ele também registra
                  indicadores): conversar consigo mesmo não faz sentido. */}
              {alerta.aluno_id !== professorId && (
                <Link
                  href={`/chat/${alerta.aluno_id}?rascunho=${encodeURIComponent(rascunhoDoAlerta(alerta))}`}
                  aria-label={`Falar com ${alerta.aluno?.nome ?? "o aluno"} no chat`}
                  title="Falar no chat"
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 self-center rounded-full px-3 text-sm font-semibold transition-all duration-200 active:scale-[.96]",
                    alerta.tipo === "indicador_vermelho"
                      ? "bg-grafite text-white hover:bg-neutral-800"
                      : "text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-50 hover:text-neutral-950",
                  )}
                >
                  <MessageCircle
                    className="size-[18px] shrink-0"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                  {alerta.tipo === "indicador_vermelho" && (
                    <span className="hidden sm:inline">Chamar no chat</span>
                  )}
                </Link>
              )}

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
