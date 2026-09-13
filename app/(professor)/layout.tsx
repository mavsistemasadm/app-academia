import { redirect } from "next/navigation";

import { BotaoVerComoAluno } from "@/components/shared/AlternarVisao";
import { BotaoSair } from "@/components/shared/BotaoSair";
import { NavProfessor } from "@/components/professor/NavProfessor";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilAtual();

  if (!perfil) redirect("/login");
  if (perfil.role !== "professor") redirect("/home");

  return (
    <div className="flex flex-1 flex-col bg-neutral-50">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-500">Painel do professor</p>
          <p className="truncate text-sm font-semibold text-neutral-900">
            {perfil.nome}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <BotaoVerComoAluno />
          <BotaoSair />
        </div>
      </header>

      <NavProfessor />

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
