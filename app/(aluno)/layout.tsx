import Image from "next/image";
import { redirect } from "next/navigation";

import { BarraVisaoAluno } from "@/components/shared/AlternarVisao";
import { BarraTopoMobile } from "@/components/shared/BarraTopoMobile";
import { BotaoSair } from "@/components/shared/BotaoSair";
import { BottomNav } from "@/components/shared/BottomNav";
import { Sidebar } from "@/components/shared/Sidebar";
import { TourGuiado } from "@/components/shared/TourGuiado";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function AlunoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilAtual();

  if (!perfil) redirect("/login");

  // Familiar só tem /acompanhar (o middleware garante): sem menu do aluno.
  if (perfil.role === "familiar") {
    return (
      <div className="flex min-h-dvh flex-1 flex-col bg-background">
        <header className="border-b border-neutral-200/80 bg-white/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 md:px-8">
            <Image
              src="/marca/logo.png"
              alt="Atitude Vital"
              width={1000}
              height={336}
              priority
              sizes="128px"
              className="h-auto w-32"
            />
            <div className="flex items-center gap-3">
              <p className="hidden text-sm text-neutral-500 sm:block">{perfil.nome}</p>
              <BotaoSair />
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-10 [--topo-cabecalho:1.75rem]">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        {/* Professor navegando pelas telas do aluno: mostra a saída de volta. */}
        {perfil.role === "professor" && <BarraVisaoAluno />}

        <BarraTopoMobile />

        {/* pb-28 reserva espaço para a barra flutuante do mobile. */}
        {/* A barra de topo já dá o respiro de cima no celular: o cabeçalho encolhe. */}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-28 [--topo-cabecalho:0.25rem] md:pb-10">

          {children}
        </main>
      </div>

      <BottomNav />
      {/* Abre sozinho na primeira visita à home (ou com ?tour=1). */}
      <TourGuiado />
    </div>
  );
}
