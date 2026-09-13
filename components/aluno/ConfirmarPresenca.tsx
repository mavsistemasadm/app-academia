"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface ConfirmarPresencaProps {
  eventoId: string;
  alunoId: string;
  confirmadoInicial: boolean | null;
}

export function ConfirmarPresenca({
  eventoId,
  alunoId,
  confirmadoInicial,
}: ConfirmarPresencaProps) {
  const router = useRouter();
  const [confirmado, setConfirmado] = useState(confirmadoInicial);
  const [salvando, setSalvando] = useState(false);
  const [, iniciarTransicao] = useTransition();

  async function responder(resposta: boolean) {
    const anterior = confirmado;
    setConfirmado(resposta);
    setSalvando(true);

    const { error } = await createClient()
      .from("evento_confirmacoes")
      .upsert(
        { evento_id: eventoId, aluno_id: alunoId, confirmado: resposta },
        { onConflict: "evento_id,aluno_id" }
      );

    setSalvando(false);

    if (error) {
      setConfirmado(anterior);
      return;
    }

    iniciarTransicao(() => router.refresh());
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => responder(true)}
        disabled={salvando}
        aria-pressed={confirmado === true}
        className={cn(
          "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors",
          confirmado === true
            ? "border-saude-verde bg-saude-verde text-white"
            : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
        )}
      >
        {salvando ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
        Eu vou
      </button>

      <button
        type="button"
        onClick={() => responder(false)}
        disabled={salvando}
        aria-pressed={confirmado === false}
        className={cn(
          "flex h-11 w-24 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition-colors",
          confirmado === false
            ? "border-neutral-400 bg-neutral-100 text-neutral-700"
            : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
        )}
      >
        <X className="size-4" aria-hidden />
        Não vou
      </button>
    </div>
  );
}
