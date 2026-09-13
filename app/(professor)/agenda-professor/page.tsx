import { redirect } from "next/navigation";

import { GerenciarAgenda } from "@/components/professor/GerenciarAgenda";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import type { Notificacao } from "@/lib/types";
import { getAgendaProfessor } from "@/lib/supabase/agenda";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";

export default async function AgendaProfessorPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const supabase = await createClient();

  const [eventos, { data: notificacoes }] = await Promise.all([
    getAgendaProfessor(perfil.id),
    supabase
      .from("notificacoes")
      .select("*")
      .eq("professor_id", perfil.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Comunicação"
          titulo="Agenda"
          descricao="Eventos do centro e comunicados para os alunos."
        />
      </div>

      <GerenciarAgenda
        professorId={perfil.id}
        eventos={eventos}
        notificacoes={(notificacoes ?? []) as Notificacao[]}
      />
    </main>
  );
}
