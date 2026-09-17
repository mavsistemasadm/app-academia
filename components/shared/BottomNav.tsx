"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Grid2x2, Loader2, LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NAV_DESKTOP, NAV_MOBILE } from "@/lib/utils/navegacao";
import { vibrar } from "@/lib/utils/toque";

const HREFS_ABAS = new Set(NAV_MOBILE.map((item) => item.href));

/** Tudo que não cabe nas 4 abas, agrupado como no menu do desktop. */
const SECOES_MAIS = NAV_DESKTOP.map(({ secao, itens }) => ({
  secao,
  itens: itens.filter((item) => !HREFS_ABAS.has(item.href)),
})).filter((s) => s.itens.length > 0);

/*
  Barra flutuante em grafite. É o único elemento escuro fixo do app do aluno,
  e por isso não compete com o conteúdo — só com o "Foco de hoje".
*/
export function BottomNav() {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);

  const emAba = [...HREFS_ABAS].some((href) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      <nav
        aria-label="Navegação principal"
        data-tour="navegacao"
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
                  onClick={() => vibrar()}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-[20px] px-0.5 py-2 text-[10.5px] font-medium tracking-tight whitespace-nowrap transition-all duration-200 active:scale-90",
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
          <li>
            <button
              type="button"
              onClick={() => {
                vibrar();
                setMaisAberto(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={maisAberto}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-[20px] px-0.5 py-2 text-[10.5px] font-medium tracking-tight whitespace-nowrap transition-all duration-200 active:scale-90",
                maisAberto || !emAba ? "bg-white/[.08] text-white" : "text-neutral-400"
              )}
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

      {maisAberto && <FolhaMais pathname={pathname} aoFechar={() => setMaisAberto(false)} />}
    </>
  );
}

function FolhaMais({ pathname, aoFechar }: { pathname: string; aoFechar: () => void }) {
  const router = useRouter();
  const [arraste, setArraste] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const inicioToque = useRef<number | null>(null);

  // Trava a rolagem da página por baixo e fecha com Esc (sistema externo: DOM e teclado).
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

  async function sair() {
    setSaindo(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
      <div
        className="absolute inset-0 bg-grafite/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={aoFechar}
      />

      <div
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[30px] bg-background pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[0_-20px_60px_-20px_rgba(12,18,20,.45)] animate-in slide-in-from-bottom-full duration-300"
        style={{
          transform: arraste > 0 ? `translateY(${arraste}px)` : undefined,
          transition: arrastando ? "none" : "transform .25s ease-out",
        }}
      >
        {/* Alça: arrastar para baixo fecha, como folha de app. */}
        <div
          className="flex cursor-grab touch-none justify-center pt-3 pb-2"
          onTouchStart={(e) => {
            inicioToque.current = e.touches[0].clientY;
            setArrastando(true);
          }}
          onTouchMove={(e) => {
            if (inicioToque.current === null) return;
            setArraste(Math.max(0, e.touches[0].clientY - inicioToque.current));
          }}
          onTouchEnd={() => {
            inicioToque.current = null;
            setArrastando(false);
            if (arraste > 90) aoFechar();
            else setArraste(0);
          }}
        >
          <span aria-hidden className="h-1.5 w-11 rounded-full bg-neutral-300" />
        </div>

        <div className="overflow-y-auto overscroll-contain px-5">
          <p className="mb-4 text-[22px] font-semibold tracking-[-0.03em] text-neutral-950 font-display">Mais</p>

          <div className="flex flex-col gap-6">
            {SECOES_MAIS.map(({ secao, itens }) => (
              <section key={secao}>
                <p className="rotulo mb-2.5 text-neutral-400">{secao}</p>
                <ul className="grid grid-cols-3 gap-2.5">
                  {itens.map(({ href, label, icone: Icone }) => {
                    const ativo = pathname === href || pathname.startsWith(`${href}/`);
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
                            ativo
                              ? "bg-grafite text-white"
                              : "bg-card text-neutral-700 ring-1 ring-neutral-200/90"
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
              </section>
            ))}
          </div>

          <button
            type="button"
            onClick={sair}
            disabled={saindo}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-saude-vermelho ring-1 ring-neutral-200 transition-colors active:bg-neutral-100"
          >
            {saindo ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
