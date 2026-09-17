"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * `icone`: o botão redondo dos cabeçalhos. `menu`: linha com texto, no pé do
 * menu lateral e da folha "Mais" do celular.
 */
export function BotaoSair({ variante = "icone" }: { variante?: "icone" | "menu" }) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (variante === "menu") {
    return (
      <button
        type="button"
        onClick={sair}
        disabled={saindo}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors duration-200 hover:bg-saude-vermelho-light hover:text-saude-vermelho disabled:opacity-60"
      >
        {saindo ? (
          <Loader2 className="size-[18px] shrink-0 animate-spin" aria-hidden />
        ) : (
          <LogOut className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
        )}
        {saindo ? "Saindo..." : "Sair da conta"}
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={sair}
      disabled={saindo}
      aria-label="Sair da conta"
      className="size-10 rounded-full text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-50 hover:text-neutral-950"
    >
      {saindo ? (
        <Loader2 className="size-[18px] animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-[18px]" strokeWidth={1.8} aria-hidden />
      )}
    </Button>
  );
}
