"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
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
