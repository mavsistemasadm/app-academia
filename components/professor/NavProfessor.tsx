"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_PROFESSOR } from "@/lib/utils/navegacao";

export function NavProfessor() {
  const caminho = usePathname();

  return (
    <nav aria-label="Seções do painel" className="border-b border-neutral-200/80 bg-white/90">
      {/* Rola na horizontal no celular em vez de quebrar linha. */}
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden">
        {NAV_PROFESSOR.map(({ href, label, icone: Icone }) => {
          const ativo = caminho === href || caminho.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200",
                  ativo
                    ? "bg-grafite text-white"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                )}
              >
                <Icone
                  className={cn("size-4", ativo && "text-ciano")}
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
