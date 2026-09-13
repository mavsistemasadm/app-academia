import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FormularioTreino } from "@/components/professor/FormularioTreino";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getAlunos, getTreinoParaEdicao } from "@/lib/supabase/professor";

export default async function EditarTreinoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { id } = await params;

  const [treino, alunos] = await Promise.all([
    getTreinoParaEdicao(id, perfil.id),
    getAlunos(),
  ]);

  if (!treino) notFound();

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
        <CabecalhoPagina rotulo="Editar treino" titulo={treino.nome} />
      </div>

      <FormularioTreino
        professorId={perfil.id}
        alunos={alunos}
        treino={treino}
      />
    </main>
  );
}
