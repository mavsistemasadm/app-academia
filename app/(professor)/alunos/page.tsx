import { redirect } from "next/navigation";

import { ListaAlunos } from "@/components/professor/ListaAlunos";
import { getPainelProfessor } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function AlunosPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { alunos } = await getPainelProfessor(perfil.id);

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Alunos
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ordenados por quem precisa de atenção primeiro.
        </p>
      </header>

      <ListaAlunos alunos={alunos} />
    </main>
  );
}
