import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FormularioTreino } from "@/components/professor/FormularioTreino";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getAlunos } from "@/lib/supabase/professor";

export default async function NovoTreinoPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const alunos = await getAlunos();

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
          Novo treino
        </h1>
      </header>

      {alunos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          Nenhum aluno cadastrado ainda. Assim que alguém criar conta, o treino
          pode ser montado aqui.
        </p>
      ) : (
        <FormularioTreino professorId={perfil.id} alunos={alunos} />
      )}
    </main>
  );
}
