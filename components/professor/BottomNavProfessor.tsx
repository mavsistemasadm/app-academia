"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_PROFESSOR } from "@/lib/utils/navegacao";
import { vibrar } from "@/lib/utils/toque";

/** No celular o professor navega pela mesma barra flutuante do aluno. */
export function BottomNavProfessor() {
  const caminho = usePathname();

  return (
    <nav
      aria-label="Seções do painel"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-50 rounded-[26px] bg-grafite/95 p-1.5 shadow-[0_16px_40px_-12px_rgba(12,18,20,.55)] ring-1 ring-white/5 backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_PROFESSOR.map(({ href, label, icone: Icone }) => {
          const ativo = caminho === href || caminho.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                onClick={() => vibrar()}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[20px] px-1 py-2 text-[11px] font-medium transition-all duration-200 active:scale-90",
                  ativo ? "bg-white/[.08] text-white" : "text-neutral-400"
                )}
              >
                <Icone
                  className={cn("size-[22px] transition-transform duration-200", ativo && "scale-110 text-ciano")}
                  strokeWidth={ativo ? 2.2 : 1.8}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
