"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BotaoSair } from "@/components/shared/BotaoSair";
import { cn } from "@/lib/utils";
import { NAV_DESKTOP } from "@/lib/utils/navegacao";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside data-tour="navegacao" className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-200/80 bg-white md:flex">
      <Link href="/home" className="block px-6 pt-7 pb-6">
        <Image
          src="/marca/logo.png"
          alt="Atitude Vital, início"
          width={1000}
          height={336}
          priority
          sizes="160px"
          className="h-auto w-40"
        />
      </Link>

      <nav
        aria-label="Navegação principal"
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6"
      >
        {NAV_DESKTOP.map(({ secao, itens }) => (
          <div key={secao} className="flex flex-col gap-0.5">
            <p className="rotulo px-3 pb-2 text-neutral-400">{secao}</p>

            {itens.map(({ href, label, icone: Icone }) => {
              const ativo = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                    ativo
                      ? "bg-grafite text-white"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                  )}
                >
                  <Icone
                    className={cn("size-[18px] shrink-0", ativo && "text-ciano")}
                    strokeWidth={ativo ? 2.2 : 1.8}
                    aria-hidden
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-neutral-200/80 px-3 py-3">
        <BotaoSair variante="menu" />
      </div>
    </aside>
  );
}
