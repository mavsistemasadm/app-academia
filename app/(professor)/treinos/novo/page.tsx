import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";

import { FormularioTreino } from "@/components/professor/FormularioTreino";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getAlunos } from "@/lib/supabase/professor";

export default async function NovoTreinoPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const alunos = await getAlunos();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <Link
        href="/treinos"
        className="-mb-3 flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950 md:-mb-5"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Treinos
      </Link>

      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Prescrição"
          titulo="Novo treino"
          descricao="O aluno vê o treino na tela dele assim que você salvar."
        />
      </div>

      {alunos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-neutral-200/90">
          <Users className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
          <p className="text-[15px] font-semibold text-neutral-950">Nenhum aluno ainda</p>
          <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
            Assim que alguém criar conta no app, o treino pode ser montado aqui.
          </p>
        </div>
      ) : (
        <FormularioTreino professorId={perfil.id} alunos={alunos} />
      )}
    </main>
  );
}
