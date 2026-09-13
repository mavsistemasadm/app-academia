import { redirect } from "next/navigation";

import { ListaAlunos } from "@/components/professor/ListaAlunos";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getPainelProfessor } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function AlunosPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { alunos } = await getPainelProfessor(perfil.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Acompanhamento"
          titulo="Alunos"
          descricao="Quem precisa de atenção aparece primeiro."
        />
      </div>

      <ListaAlunos alunos={alunos} />
    </main>
  );
}
