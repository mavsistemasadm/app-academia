import Link from "next/link";
import { Check, Dumbbell, Pill, UserRound } from "lucide-react";

import type { AlunoNoPainel } from "@/lib/supabase/painel-professor";
import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rotularCondicoes } from "@/lib/utils/avatares";
import { DIAS_PARA_ALERTA_DE_SUMICO } from "@/lib/utils/presenca";
import { HUMOR_CONFIG } from "@/lib/utils/saudacao";
import { SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const BORDA: Record<SemaforoStatus, string> = {
  verde: "border-l-saude-verde",
  amarelo: "border-l-saude-amarelo",
  vermelho: "border-l-saude-vermelho",
};

const BADGE: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde-light text-saude-verde",
  amarelo: "bg-saude-amarelo-light text-saude-amarelo",
  vermelho: "bg-saude-vermelho-light text-saude-vermelho",
};

export function CardAluno({ aluno }: { aluno: AlunoNoPainel }) {
  const { perfil, status } = aluno;
  const inicial = perfil.nome.charAt(0).toUpperCase();

  const sinais: string[] = [];
  if (aluno.presenteAgora) sinais.push("Na academia agora");
  if (aluno.dosesPendentes > 0) {
    sinais.push(
      `${aluno.dosesPendentes} ${aluno.dosesPendentes === 1 ? "remédio pendente" : "remédios pendentes"}`
    );
  }
  /*
    `null` é "não achamos presença na janela de histórico" — quase sempre
    aluno novo, mas também quem sumiu faz meses. Dizer "nunca treinou" seria
    afirmar demais; o professor precisa ligar nos dois casos igual.
  */
  if (aluno.diasSemAparecer === null) sinais.push("Sem presença registrada");
  else if (aluno.diasSemAparecer >= DIAS_PARA_ALERTA_DE_SUMICO) {
    sinais.push(`${aluno.diasSemAparecer} dias sem aparecer`);
  }

  return (
    <Link
      href={`/alunos/${perfil.id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-l-4 border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm",
        BORDA[status]
      )}
    >
      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-base font-semibold text-neutral-500">
        {perfil.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={perfil.foto_url} alt="" className="size-full object-cover" />
        ) : (
          inicial || <UserRound className="size-5" aria-hidden />
        )}
        {aluno.presenteAgora && (
          <span
            className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-white bg-saude-verde"
            aria-label="Na academia agora"
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">
          {perfil.nome}
        </p>
        <p className="truncate text-xs text-neutral-500">
          {rotularCondicoes(perfil.avatar_condicao)}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {aluno.ultimoIndicador && (
            <span className="text-xs text-neutral-600 tabular-nums">
              {aluno.ultimoIndicador.valorFormatado}
              {aluno.ultimoIndicador.tipo !== "peso" && ""}
            </span>
          )}

          {aluno.humorHoje && (
            <span className="text-xs text-neutral-600">
              <span aria-hidden>{HUMOR_CONFIG[aluno.humorHoje].emoji}</span>{" "}
              {HUMOR_CONFIG[aluno.humorHoje].label}
            </span>
          )}

          {aluno.temTreinoHoje && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                aluno.treinouHoje ? "text-saude-verde" : "text-neutral-400"
              )}
            >
              {aluno.treinouHoje ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Dumbbell className="size-3.5" aria-hidden />
              )}
              {aluno.treinouHoje ? "Treinou" : "Treino hoje"}
            </span>
          )}

          {aluno.dosesPendentes > 0 && (
            <span className="flex items-center gap-1 text-xs text-saude-amarelo">
              <Pill className="size-3.5" aria-hidden />
              {aluno.dosesPendentes}
            </span>
          )}
        </div>

        {sinais.length > 0 && (
          <p className="mt-1 truncate text-xs text-neutral-500">
            {sinais.join(" · ")}
          </p>
        )}
      </div>

      <span
        className={cn(
          "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
          BADGE[status]
        )}
      >
        {SEMAFORO_CONFIG[status].label}
      </span>
    </Link>
  );
}
