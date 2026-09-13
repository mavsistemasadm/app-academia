import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FormularioAvaliacao } from "@/components/professor/FormularioAvaliacao";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";

export default async function NovaAvaliacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const professor = await getPerfilAtual();
  if (!professor) redirect("/login");

  const { id } = await params;

  const supabase = await createClient();
  const { data: aluno } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();

  if (!aluno) notFound();

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/alunos/${id}`}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {aluno.nome}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Nova avaliação física
        </h1>
      </header>

      <FormularioAvaliacao
        professorId={professor.id}
        alunoId={aluno.id}
        alunoNome={aluno.nome}
      />
    </main>
  );
}
