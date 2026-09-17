import { redirect } from "next/navigation";

import { GerenciarDesafios } from "@/components/professor/GerenciarDesafios";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getDesafiosDoProfessor } from "@/lib/supabase/desafios";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";

export default async function DesafiosProfessorPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const supabase = await createClient();

  const [{ desafios, indisponivel }, { data: alunos }, { data: participantes }] =
    await Promise.all([
      getDesafiosDoProfessor(),
      supabase
        .from("profiles")
        .select("id, nome")
        .eq("role", "aluno")
        .order("nome", { ascending: true }),
      supabase.from("desafio_participantes").select("desafio_id, aluno_id, status"),
    ]);

  // Quem o professor convidou ou quem já entrou: os dois aparecem marcados.
  const porDesafio: Record<string, string[]> = {};
  for (const p of (participantes ?? []) as { desafio_id: string; aluno_id: string }[]) {
    (porDesafio[p.desafio_id] ??= []).push(p.aluno_id);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Turma"
          titulo="Desafios"
          descricao="Um período, um ranking. Os pontos saem do que o aluno já faz no app: aparecer, treinar, medir, beber água e tomar o medicamento na hora."
        />
      </div>

      <GerenciarDesafios
        professorId={perfil.id}
        desafios={desafios}
        alunos={(alunos ?? []) as { id: string; nome: string }[]}
        participantesPorDesafio={porDesafio}
        indisponivel={indisponivel}
      />
    </main>
  );
}
