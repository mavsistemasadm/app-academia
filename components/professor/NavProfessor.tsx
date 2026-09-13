"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_PROFESSOR } from "@/lib/utils/navegacao";

export function NavProfessor() {
  const caminho = usePathname();

  return (
    <nav
      aria-label="Seções do painel"
      className="sticky top-[57px] z-30 border-b border-neutral-200 bg-white"
    >
      {/* Rola na horizontal no celular em vez de quebrar linha. */}
      <ul className="flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_PROFESSOR.map(({ href, label, icone: Icone }) => {
          const ativo = caminho === href || caminho.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  ativo
                    ? "border-primary text-primary"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                )}
              >
                <Icone className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
