import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FormularioAvaliacao } from "@/components/professor/FormularioAvaliacao";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
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
  const [{ data: aluno }, { data: ultimaComSexo }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, data_nascimento")
      .eq("id", id)
      .maybeSingle(),
    // Repete o sexo da última avaliação com dobras. Antes da migração 020 a
    // coluna não existe, a consulta volta com erro e o campo só fica vazio.
    supabase
      .from("avaliacoes_fisicas")
      .select("sexo")
      .eq("aluno_id", id)
      .not("sexo", "is", null)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!aluno) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <Link
        href={`/alunos/${id}`}
        className="-mb-3 flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950 md:-mb-5"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {aluno.nome}
      </Link>

      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Avaliação física"
          titulo="Nova avaliação"
          descricao={`Medidas de ${aluno.nome}. A altura lançada aqui é o que transforma o peso em IMC.`}
        />
      </div>

      <FormularioAvaliacao
        professorId={professor.id}
        alunoId={aluno.id}
        alunoNome={aluno.nome}
        nascimento={aluno.data_nascimento ?? null}
        sexoAnterior={ultimaComSexo?.sexo ?? null}
      />
    </main>
  );
}
