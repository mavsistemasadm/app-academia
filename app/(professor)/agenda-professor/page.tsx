import { redirect } from "next/navigation";

import { GerenciarAgenda } from "@/components/professor/GerenciarAgenda";
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
    <main className="flex flex-1 flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Agenda
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Eventos do centro e comunicados para os alunos.
        </p>
      </header>

      <GerenciarAgenda
        professorId={perfil.id}
        eventos={eventos}
        notificacoes={(notificacoes ?? []) as Notificacao[]}
      />
    </main>
  );
}
