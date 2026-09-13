import { redirect } from "next/navigation";
import { CalendarDays, Dumbbell } from "lucide-react";

import { ExecucaoTreino } from "@/components/aluno/ExecucaoTreino";
import { PortaoPreTreino } from "@/components/aluno/PortaoPreTreino";
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
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">
          {treino?.nome ?? "Treino"}
        </h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {treino
            ? (treino.descricao ??
              `${treino.exercicios.length} ${treino.exercicios.length === 1 ? "exercício" : "exercícios"} para hoje`)
            : "Nada marcado para hoje."}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {treino && treino.exercicios.length > 0 ? (
          <div className="-mt-14 md:mt-0">
            {medirAntes ? (
              <PortaoPreTreino
                alunoId={perfil.id}
                tipo={medirAntes}
                altura={altura}
              >
                <ExecucaoTreino
                  alunoId={perfil.id}
                  treino={treino}
                  hoje={hoje}
                />
              </PortaoPreTreino>
            ) : (
              <ExecucaoTreino
                alunoId={perfil.id}
                treino={treino}
                hoje={hoje}
              />
            )}
          </div>
        ) : (
          <div className="-mt-14 flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center md:mt-0">
            <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <p className="text-base font-semibold text-neutral-900">
              {treino
                ? "Este treino ainda não tem exercícios"
                : "Nenhum treino para hoje"}
            </p>
            <p className="max-w-xs text-sm text-neutral-500">
              {treino
                ? "Seu professor começou a montar, mas ainda não incluiu os exercícios."
                : "Descanso também faz parte. Seu professor não marcou treino para este dia da semana."}
            </p>
          </div>
        )}

        {/* ── Os outros dias ─────────────────────────────────────── */}
        {outros.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Seus outros treinos
            </h2>

            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {outros.map((outro) => (
                <li key={outro.id} className="flex items-center gap-3 p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                    <CalendarDays className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {outro.nome}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {rotularDias(outro.diaSemana)} · {outro.totalExercicios}{" "}
                      {outro.totalExercicios === 1 ? "exercício" : "exercícios"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
