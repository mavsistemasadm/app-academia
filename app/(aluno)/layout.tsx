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
    <div className="flex min-h-dvh flex-1 bg-neutral-100">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        {/* Professor navegando pelas telas do aluno: mostra a saída de volta. */}
        {perfil.role === "professor" && <BarraVisaoAluno />}

        {/* pb-20 reserva espaço para a bottom nav fixa do mobile. */}
        <main className="flex flex-1 flex-col pb-20 md:pb-8">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
