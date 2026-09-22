"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid2x2 } from "lucide-react";

import { BotaoSair } from "@/components/shared/BotaoSair";
import { cn } from "@/lib/utils";
import { NAV_PROFESSOR_MOBILE, navDoProfessor } from "@/lib/utils/navegacao";
import { vibrar } from "@/lib/utils/toque";

const ITEM =
  "flex w-full flex-col items-center gap-1 rounded-[20px] px-0.5 py-2 text-[10.5px] font-medium tracking-tight whitespace-nowrap transition-all duration-200 active:scale-90";

/** No celular o professor navega pela mesma barra flutuante do aluno. */
export function BottomNavProfessor({ ehAdmin = false }: { ehAdmin?: boolean }) {
  const caminho = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);

  const emAba = NAV_PROFESSOR_MOBILE.some(
    ({ href }) => caminho === href || caminho.startsWith(`${href}/`)
  );

  return (
    <>
      <nav
        aria-label="Seções do painel"
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-50 rounded-[26px] bg-grafite/95 p-1.5 shadow-[0_16px_40px_-12px_rgba(12,18,20,.55)] ring-1 ring-white/5 backdrop-blur-xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV_PROFESSOR_MOBILE.map(({ href, label, icone: Icone }) => {
            const ativo = caminho === href || caminho.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={ativo ? "page" : undefined}
                  onClick={() => vibrar()}
                  className={cn(ITEM, ativo ? "bg-white/[.08] text-white" : "text-neutral-400")}
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

          <li>
            <button
              type="button"
              onClick={() => {
                vibrar();
                setMaisAberto(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={maisAberto}
              className={cn(ITEM, maisAberto || !emAba ? "bg-white/[.08] text-white" : "text-neutral-400")}
            >
              <Grid2x2
                className={cn("size-[22px]", (maisAberto || !emAba) && "text-ciano")}
                strokeWidth={maisAberto || !emAba ? 2.2 : 1.8}
                aria-hidden
              />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      {maisAberto && (
        <FolhaMais
          caminho={caminho}
          ehAdmin={ehAdmin}
          aoFechar={() => setMaisAberto(false)}
        />
      )}
    </>
  );
}

function FolhaMais({
  caminho,
  ehAdmin,
  aoFechar,
}: {
  caminho: string;
  ehAdmin: boolean;
  aoFechar: () => void;
}) {
  // Trava a rolagem por baixo e fecha com Esc (sistema externo: DOM e teclado).
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aoFechar]);

  const restantes = navDoProfessor(ehAdmin).filter(
    (item) => !NAV_PROFESSOR_MOBILE.some((m) => m.href === item.href)
  );

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
      <div
        className="absolute inset-0 bg-grafite/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={aoFechar}
      />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[30px] bg-background pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-20px_60px_-20px_rgba(12,18,20,.45)] animate-in slide-in-from-bottom-full duration-300">
        <div className="flex justify-center pt-3 pb-2">
          <span aria-hidden className="h-1.5 w-11 rounded-full bg-neutral-300" />
        </div>

        <div className="overflow-y-auto overscroll-contain px-5">
          <p className="mb-4 font-display text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
            Mais
          </p>

          <ul className="grid grid-cols-3 gap-2.5">
            {restantes.map(({ href, label, icone: Icone }) => {
              const ativo = caminho === href || caminho.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => {
                      vibrar();
                      aoFechar();
                    }}
                    className={cn(
                      "flex h-full flex-col items-center gap-2 rounded-2xl px-2 py-3.5 text-center text-[12.5px] leading-tight font-medium transition-all duration-150 active:scale-95",
                      ativo ? "bg-grafite text-white" : "bg-card text-neutral-700 ring-1 ring-neutral-200/90"
                    )}
                  >
                    <Icone
                      className={cn("size-6", ativo ? "text-ciano" : "text-primary")}
                      strokeWidth={1.8}
                      aria-hidden
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6">
            <BotaoSair variante="menu" />
          </div>
        </div>
      </div>
    </div>
  );
}
