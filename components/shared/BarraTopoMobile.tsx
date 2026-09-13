"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_MOBILE, tituloDaRota } from "@/lib/utils/navegacao";

const RAIZES = new Set(NAV_MOBILE.map((item) => item.href));

/**
 * Barra de topo do celular, como em app nativo: some quando a tela está no
 * início (o título grande da página já diz onde se está) e aparece com
 * fundo desfocado e título compacto ao rolar. Fora das abas, mostra "voltar".
 * A home tem topo próprio e fica sem ela.
 */
export function BarraTopoMobile() {
  const pathname = usePathname();
  const router = useRouter();
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 48);
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  if (pathname === "/home") return null;

  const raiz = RAIZES.has(pathname);

  function voltar() {
    if (window.history.length > 1) router.back();
    else router.push("/home");
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200 md:hidden",
        rolou
          ? "bg-background/85 shadow-[0_1px_0_rgba(12,18,20,.07)] backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <div className="flex h-12 items-center px-2">
        {raiz ? (
          <span className="w-3" />
        ) : (
          <button
            type="button"
            onClick={voltar}
            aria-label="Voltar"
            className="flex size-11 items-center justify-center rounded-full text-neutral-950 transition-all active:scale-90 active:bg-neutral-200/60"
          >
            <ChevronLeft className="size-6" strokeWidth={2.2} aria-hidden />
          </button>
        )}
        <p
          aria-hidden={!rolou}
          className={cn(
            "min-w-0 flex-1 truncate font-display text-[16px] font-semibold tracking-[-0.02em] text-neutral-950 transition-all duration-200",
            raiz ? "text-left" : "text-center",
            rolou ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          )}
        >
          {tituloDaRota(pathname)}
        </p>
        {!raiz && <span className="size-11" />}
      </div>
    </div>
  );
}
