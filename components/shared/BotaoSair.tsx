"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

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
      size="icon-lg"
      onClick={sair}
      disabled={saindo}
      aria-label="Sair da conta"
      className="rounded-xl text-neutral-500"
    >
      <LogOut className="size-5" aria-hidden />
    </Button>
  );
}
