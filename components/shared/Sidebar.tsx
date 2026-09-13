"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_DESKTOP } from "@/lib/utils/navegacao";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-200 bg-white md:flex">
      <Link
        href="/home"
        className="flex items-center gap-2 px-5 py-5 text-primary"
      >
        <HeartPulse className="size-6 shrink-0" aria-hidden />
        <span className="text-lg font-bold tracking-tight">
          Saúde Conectada
        </span>
      </Link>

      <nav
        aria-label="Navegação principal"
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6"
      >
        {NAV_DESKTOP.map(({ secao, itens }) => (
          <div key={secao} className="flex flex-col gap-1">
            <p className="px-2 pb-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              {secao}
            </p>

            {itens.map(({ href, label, icone: Icone }) => {
              const ativo = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    ativo
                      ? "bg-primary/10 text-primary"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  <Icone className="size-5 shrink-0" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
