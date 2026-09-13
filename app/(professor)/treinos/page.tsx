import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Dumbbell, Plus } from "lucide-react";

import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
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
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Prescrição"
          titulo="Treinos"
          descricao={
            treinos.length === 0
              ? "Nenhum treino montado ainda."
              : `${treinos.length} ${treinos.length === 1 ? "treino montado" : "treinos montados"}.`
          }
          acao={
            <Button
              render={<Link href="/treinos/novo" />}
              // O elemento é um <a> de verdade: sem isso a Base UI reclama
              // que perdeu a semântica nativa de <button>.
              nativeButton={false}
              className="h-11 rounded-full px-5 font-semibold"
            >
              <Plus className="size-5" aria-hidden />
              Novo treino
            </Button>
          }
        />
      </div>

      {treinos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-neutral-200/90">
          <Dumbbell className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
          <p className="text-[15px] font-semibold text-neutral-950">
            Monte o primeiro treino
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
            Escolha o aluno, os dias da semana e os exercícios. Ele vê na hora na
            tela dele.
          </p>
          <Link href="/treinos/novo" className="mt-1 text-sm font-semibold text-primary">
            Criar treino →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
          {treinos.map((treino) => (
            <li key={treino.id}>
              <Link
                href={`/treinos/${treino.id}`}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors hover:bg-neutral-50 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_90px_auto] md:px-5 md:py-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-neutral-950">
                      {treino.nome}
                    </span>
                    {!treino.ativo && (
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500">
                        Inativo
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[13px] text-neutral-500">
                    {treino.aluno?.nome ?? "Aluno removido"}
                    <span className="md:hidden">
                      {" · "}
                      {treino.totalExercicios}{" "}
                      {treino.totalExercicios === 1 ? "exercício" : "exercícios"}
                    </span>
                  </p>
                </div>

                <ChevronRight
                  className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 md:order-last"
                  aria-hidden
                />

                <p className="rotulo col-span-2 truncate text-neutral-400 md:col-span-1">
                  {rotularDias(treino.diaSemana)}
                </p>

                <p className="numero hidden text-right text-lg leading-none font-semibold text-neutral-950 md:block">
                  {treino.totalExercicios}
                  <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
                    {treino.totalExercicios === 1 ? "exercício" : "exercícios"}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
