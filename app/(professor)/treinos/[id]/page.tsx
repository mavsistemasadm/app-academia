import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FormularioTreino } from "@/components/professor/FormularioTreino";
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
    <main className="flex flex-1 flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/treinos"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Treinos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {treino.nome}
        </h1>
      </header>

      <FormularioTreino
        professorId={perfil.id}
        alunos={alunos}
        treino={treino}
      />
    </main>
  );
}
