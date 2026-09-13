import Link from "next/link";
import { Check, ChevronRight, Dumbbell, Pill, UserRound } from "lucide-react";

import { FaixaSemaforo } from "@/components/shared/FaixaSemaforo";
import type { AlunoNoPainel } from "@/lib/supabase/painel-professor";
import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AVATAR_CONFIG } from "@/lib/utils/avatares";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";
import { DIAS_PARA_ALERTA_DE_SUMICO } from "@/lib/utils/presenca";
import { HUMOR_CONFIG } from "@/lib/utils/saudacao";
import { SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const PONTO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde",
  amarelo: "bg-saude-amarelo",
  vermelho: "bg-saude-vermelho",
};

/** Quantas condições cabem na linha antes de virar "+n". */
const MAX_CONDICOES = 3;

/**
 * Uma linha de aluno, sem moldura própria: quem lista decide o card em volta
 * (dashboard e lista usam um card só com divisórias).
 */
export function CardAluno({ aluno }: { aluno: AlunoNoPainel }) {
  const { perfil, status, ultimoIndicador } = aluno;
  const inicial = perfil.nome.charAt(0).toUpperCase();
  const condicoes = perfil.avatar_condicao ?? [];

  /*
    `null` é "não achamos presença na janela de histórico" — quase sempre
    aluno novo, mas também quem sumiu faz meses. Dizer "nunca treinou" seria
    afirmar demais; o professor precisa ligar nos dois casos igual.
  */
  const sumico =
    aluno.diasSemAparecer === null
      ? "Sem presença registrada"
      : aluno.diasSemAparecer >= DIAS_PARA_ALERTA_DE_SUMICO
        ? `${aluno.diasSemAparecer} dias sem aparecer`
        : null;

  const config = ultimoIndicador ? CONFIG_INDICADORES[ultimoIndicador.tipo] : null;
  const valorIndicador = ultimoIndicador
    ? ultimoIndicador.valorFormatado.replace(" kg", "")
    : null;
  const faixa = ultimoIndicador
    ? ultimoIndicador.tipo === "peso"
      ? ultimoIndicador.imc
        ? { tipo: "peso" as const, valor: ultimoIndicador.imc }
        : null
      : {
          tipo: ultimoIndicador.tipo,
          valor: ultimoIndicador.valorPrincipal,
          valorSecundario: ultimoIndicador.valorSecundario,
        }
    : null;

  return (
    <Link
      href={`/alunos/${perfil.id}`}
      className="group flex h-full items-center gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-neutral-50 md:gap-4 md:px-5"
    >
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base font-semibold text-neutral-500">
        <span className="flex size-full items-center justify-center overflow-hidden rounded-full">
          {perfil.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={perfil.foto_url} alt="" className="size-full object-cover" />
          ) : (
            inicial || <UserRound className="size-5" aria-hidden />
          )}
        </span>
        {aluno.presenteAgora && (
          <span
            className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-[2.5px] border-white bg-ciano"
            aria-label="Na academia agora"
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", PONTO[status])} />
          <span className="sr-only">{SEMAFORO_CONFIG[status].label}: </span>
          <span className="truncate text-[15px] font-semibold text-neutral-950">
            {perfil.nome}
          </span>
        </p>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {condicoes.length === 0 ? (
            <span className="text-[13px] text-neutral-400">Sem condição informada</span>
          ) : (
            <>
              {condicoes.slice(0, MAX_CONDICOES).map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600"
                >
                  {AVATAR_CONFIG[c]?.label ?? c}
                </span>
              ))}
              {condicoes.length > MAX_CONDICOES && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
                  +{condicoes.length - MAX_CONDICOES}
                </span>
              )}
            </>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-500">
          {aluno.temTreinoHoje && (
            <span
              className={cn(
                "flex items-center gap-1",
                aluno.treinouHoje ? "font-medium text-saude-verde" : "text-neutral-500"
              )}
            >
              {aluno.treinouHoje ? (
                <Check className="size-3.5" strokeWidth={2.2} aria-hidden />
              ) : (
                <Dumbbell className="size-3.5 text-neutral-400" strokeWidth={1.8} aria-hidden />
              )}
              {aluno.treinouHoje ? "Treinou hoje" : "Treino hoje"}
            </span>
          )}

          {aluno.humorHoje && (
            <span className="flex items-center gap-1">
              <span aria-hidden>{HUMOR_CONFIG[aluno.humorHoje].emoji}</span>
              {HUMOR_CONFIG[aluno.humorHoje].label}
            </span>
          )}

          {aluno.dosesPendentes > 0 && (
            <span className="flex items-center gap-1 font-medium text-[#b45309]">
              <Pill className="size-3.5" strokeWidth={1.9} aria-hidden />
              {aluno.dosesPendentes}{" "}
              {aluno.dosesPendentes === 1 ? "remédio pendente" : "remédios pendentes"}
            </span>
          )}

          {sumico && <span className="text-neutral-500">{sumico}</span>}
        </div>
      </div>

      <div className="flex w-[84px] shrink-0 flex-col items-end gap-1.5 sm:w-24">
        {ultimoIndicador && config ? (
          <>
            <span className="rotulo text-neutral-400">{config.labelCurto}</span>
            <p className="numero text-xl leading-none font-semibold whitespace-nowrap text-neutral-950">
              {valorIndicador}
              <span className="ml-0.5 font-sans text-[10px] font-medium tracking-normal text-neutral-400">
                {config.unidade}
              </span>
            </p>
            {faixa && (
              <FaixaSemaforo
                tipo={faixa.tipo}
                valor={faixa.valor}
                valorSecundario={"valorSecundario" in faixa ? faixa.valorSecundario : undefined}
                className="mt-1 w-full"
              />
            )}
          </>
        ) : (
          <span className="text-right text-[13px] leading-snug text-neutral-400">
            Sem medição
          </span>
        )}
      </div>

      <ChevronRight
        className="hidden size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 sm:block"
        aria-hidden
      />
    </Link>
  );
}
