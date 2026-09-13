import Link from "next/link";
import { ArrowLeftRight, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Só o professor alterna de visão. O middleware já libera as rotas de aluno
 * para ele, então isso aqui é navegação — não há sessão nem papel trocado.
 */
export function BotaoVerComoAluno() {
  return (
    <Button
      variant="outline"
      render={<Link href="/home" />}
      // O elemento é um <a> de verdade: sem isso a Base UI reclama
      // que perdeu a semântica nativa de <button>.
      nativeButton={false}
      aria-label="Ver como aluno"
      className="h-10 gap-2 rounded-full px-3 sm:px-3.5"
    >
      <Eye className="size-4" aria-hidden />
      {/* No celular o cabeçalho é estreito: só o ícone. */}
      <span className="hidden sm:inline">Ver como aluno</span>
    </Button>
  );
}

/** Barra fixa que aparece no topo das telas de aluno quando quem olha é o professor. */
export function BarraVisaoAluno() {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-grafite px-4 py-2.5 text-white">
      <span className="flex items-center gap-2 text-sm font-medium text-white/75">
        <Eye className="size-4 shrink-0 text-ciano" aria-hidden />
        <span className="sm:hidden">Visão do aluno</span>
        <span className="hidden sm:inline">Você está na visão do aluno</span>
      </span>
      <Link
        href="/dashboard"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
      >
        <ArrowLeftRight className="size-4" aria-hidden />
        <span className="sm:hidden">Painel</span>
        <span className="hidden sm:inline">Voltar ao painel</span>
      </Link>
    </div>
  );
}
