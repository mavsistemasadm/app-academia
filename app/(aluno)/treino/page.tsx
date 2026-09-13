import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";

import { ExecucaoTreino } from "@/components/aluno/ExecucaoTreino";
import { PortaoPreTreino } from "@/components/aluno/PortaoPreTreino";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getTreinoAluno } from "@/lib/supabase/treino";
import { DIAS_SEMANA, normalizarDiaSemana } from "@/lib/utils/datas";

const NOME_DIA: Record<string, string> = {
  dom: "Domingo",
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
};

/** "Segunda · Quarta · Sexta", na ordem da semana. */
function rotularDias(dias: string[]): string {
  if (dias.length === 0) return "Todos os dias";

  const normalizados = dias
    .map(normalizarDiaSemana)
    .filter((d): d is (typeof DIAS_SEMANA)[number] => d !== null);

  if (normalizados.length === 0) return dias.join(" · ");

  return DIAS_SEMANA.filter((d) => normalizados.includes(d))
    .map((d) => NOME_DIA[d])
    .join(" · ");
}

export default async function TreinoPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { treino, outros, hoje, medirAntes, altura } =
    await getTreinoAluno(perfil);

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Treino de hoje"
        titulo={
          !treino || treino.exercicios.length === 0
            ? "Treino"
            : treino.concluido
              ? "Treino feito!"
              : "Bora treinar"
        }
        descricao={
          treino
            ? (treino.descricao ??
              `${treino.exercicios.length} ${treino.exercicios.length === 1 ? "exercício" : "exercícios"} preparados pelo seu professor.`)
            : "Nada marcado para hoje."
        }
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {treino && treino.exercicios.length > 0 ? (
          medirAntes ? (
            <PortaoPreTreino
              alunoId={perfil.id}
              tipo={medirAntes}
              altura={altura}
            >
              <ExecucaoTreino alunoId={perfil.id} treino={treino} hoje={hoje} />
            </PortaoPreTreino>
          ) : (
            <ExecucaoTreino alunoId={perfil.id} treino={treino} hoje={hoje} />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
            <Dumbbell
              className="size-6 text-neutral-400"
              strokeWidth={1.8}
              aria-hidden
            />
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-neutral-950">
              {treino
                ? "Este treino ainda está sendo montado"
                : "Hoje é dia de descanso"}
            </h2>
            <p className="max-w-xs text-[15px] leading-relaxed text-neutral-500">
              {treino
                ? "Seu professor começou o treino, mas ainda não incluiu os exercícios. Assim que ele terminar, aparece aqui."
                : "Seu professor não marcou treino para este dia da semana. Descansar também faz parte da evolução."}
            </p>
          </div>
        )}

        {/* ── Os outros dias ─────────────────────────────────────── */}
        {outros.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
              Seus outros treinos
            </h2>

            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {outros.map((outro) => (
                <li
                  key={outro.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-neutral-950">
                      {outro.nome}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-neutral-500">
                      {rotularDias(outro.diaSemana)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="numero text-lg font-semibold text-neutral-950">
                      {outro.totalExercicios}
                    </span>
                    <span className="ml-1 text-xs font-medium text-neutral-400">
                      {outro.totalExercicios === 1 ? "exercício" : "exercícios"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
