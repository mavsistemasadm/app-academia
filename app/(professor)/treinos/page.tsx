import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getTreinosDoProfessor } from "@/lib/supabase/professor";
import { DIAS_SEMANA, normalizarDiaSemana } from "@/lib/utils/datas";

const SIGLA_DIA: Record<string, string> = {
  dom: "Dom",
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
};

function rotularDias(dias: string[]): string {
  if (dias.length === 0) return "Todos os dias";

  const normalizados = new Set(
    dias.map(normalizarDiaSemana).filter(Boolean) as string[]
  );

  const ordenados = DIAS_SEMANA.filter((d) => normalizados.has(d));
  return ordenados.length > 0
    ? ordenados.map((d) => SIGLA_DIA[d]).join(" · ")
    : dias.join(" · ");
}

export default async function TreinosProfessorPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const treinos = await getTreinosDoProfessor(perfil.id);

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Treinos
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {treinos.length === 0
              ? "Nenhum treino montado ainda."
              : `${treinos.length} ${treinos.length === 1 ? "treino" : "treinos"} montados.`}
          </p>
        </div>

        <Button
          render={<Link href="/treinos/novo" />}
          // O elemento é um <a> de verdade: sem isso a Base UI reclama
          // que perdeu a semântica nativa de <button>.
          nativeButton={false}
          className="h-11 shrink-0 rounded-xl px-4 font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          Novo
        </Button>
      </header>

      {treinos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <p className="text-base font-semibold text-neutral-900">
            Monte o primeiro treino
          </p>
          <p className="max-w-xs text-sm text-neutral-500">
            Escolha o aluno, os dias da semana e os exercícios. Ele vê na hora
            na tela dele.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {treinos.map((treino) => (
            <li key={treino.id}>
              <Link
                href={`/treinos/${treino.id}`}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <Dumbbell className="size-5" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {treino.nome}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {treino.aluno?.nome ?? "Aluno removido"} ·{" "}
                    {rotularDias(treino.diaSemana)} · {treino.totalExercicios}{" "}
                    {treino.totalExercicios === 1 ? "exercício" : "exercícios"}
                  </p>
                </div>

                {!treino.ativo && (
                  <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                    Inativo
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
