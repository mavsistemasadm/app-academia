import { redirect } from "next/navigation";

import { GerenciarEquipe } from "@/components/professor/GerenciarEquipe";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { ehAdmin, listarEquipe, type ResultadoEquipe } from "@/lib/supabase/equipe";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function EquipePage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");
  if (!ehAdmin(perfil)) redirect("/dashboard");

  // Service role só aqui, no servidor: o cliente recebe a lista pronta.
  let equipe: ResultadoEquipe | null = null;
  try {
    equipe = await listarEquipe();
  } catch {
    equipe = null;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Centro"
          titulo="Equipe"
          descricao="Convide professores e escolha quem também cuida da equipe."
        />
      </div>

      <GerenciarEquipe
        meuId={perfil.id}
        membros={equipe?.disponivel ? equipe.membros : []}
        erroLista={equipe === null}
      />
    </main>
  );
}
