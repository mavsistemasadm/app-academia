"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_MOBILE } from "@/lib/utils/navegacao";

/*
  Barra flutuante em grafite. É o único elemento escuro fixo do app do aluno,
  e por isso não compete com o conteúdo — só com o "Foco de hoje".
*/
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-50 rounded-[26px] bg-grafite/95 p-1.5 shadow-[0_16px_40px_-12px_rgba(12,18,20,.55)] ring-1 ring-white/5 backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_MOBILE.map(({ href, label, icone: Icone }) => {
          const ativo = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[20px] px-1 py-2 text-[11px] font-medium transition-colors duration-200",
                  ativo
                    ? "bg-white/[.08] text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Icone
                  className={cn("size-[22px]", ativo && "text-ciano")}
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
