import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BotaoVerComoAluno } from "@/components/shared/AlternarVisao";
import { BotaoSair } from "@/components/shared/BotaoSair";
import { SinoNotificacoes } from "@/components/shared/SinoNotificacoes";
import { BottomNavProfessor } from "@/components/professor/BottomNavProfessor";
import { NavProfessor } from "@/components/professor/NavProfessor";
import { getNotificacoesProfessor } from "@/lib/supabase/notificacoes";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function ProfessorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilAtual();

  if (!perfil) redirect("/login");
  if (perfil.role !== "professor") redirect("/home");

  const notificacoes = await getNotificacoesProfessor(perfil);

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* Cabeçalho e abas grudam juntos: um bloco só, sem somar alturas à mão. */}
      <div data-print="ocultar" className="sticky top-0 z-40 backdrop-blur-xl">
        <header className="border-b border-neutral-200/80 bg-white/90">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {/* No celular só o símbolo cabe; do tablet para cima, a logo inteira. */}
              <Link href="/dashboard" className="shrink-0">
                <Image
                  src="/marca/simbolo.png"
                  alt="Atitude Vital, painel"
                  width={512}
                  height={512}
                  priority
                  sizes="36px"
                  className="size-9 sm:hidden"
                />
                <Image
                  src="/marca/logo.png"
                  alt="Atitude Vital, painel"
                  width={1000}
                  height={336}
                  priority
                  sizes="128px"
                  className="hidden h-auto w-32 sm:block"
                />
              </Link>
              <div className="hidden min-w-0 border-l border-neutral-200 pl-3 sm:block">
                <p className="rotulo text-neutral-400">Painel do professor</p>
                <p className="truncate text-sm font-semibold text-neutral-950">
                  {perfil.nome}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <SinoNotificacoes
                itens={notificacoes}
                usuarioId={perfil.id}
                papel="professor"
              />
              <BotaoVerComoAluno />
              <BotaoSair />
            </div>
          </div>
        </header>

        {/* No celular as seções vão para a barra de baixo. */}
        <div className="hidden md:block">
          <NavProfessor />
        </div>
      </div>

      {/* pb-28 reserva espaço para a barra flutuante do celular. */}
      <div className="flex flex-1 flex-col pb-28 md:pb-0">{children}</div>
      <BottomNavProfessor />
    </div>
  );
}
