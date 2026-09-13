import { redirect } from "next/navigation";

import { BarraVisaoAluno } from "@/components/shared/AlternarVisao";
import { BottomNav } from "@/components/shared/BottomNav";
import { Sidebar } from "@/components/shared/Sidebar";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function AlunoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilAtual();

  if (!perfil) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-1 bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        {/* Professor navegando pelas telas do aluno: mostra a saída de volta. */}
        {perfil.role === "professor" && <BarraVisaoAluno />}

        {/* pb-28 reserva espaço para a barra flutuante do mobile. */}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-28 md:pb-10">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
