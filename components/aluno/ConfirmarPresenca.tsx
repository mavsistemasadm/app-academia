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
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => responder(true)}
        disabled={salvando}
        aria-pressed={confirmado === true}
        className={cn(
          "flex h-12 min-w-[8.5rem] flex-1 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-all duration-200 active:scale-[.98] disabled:opacity-70",
          confirmado === true
            ? "bg-grafite text-white"
            : "bg-card text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
        )}
      >
        {salvando ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check
            className={cn("size-4", confirmado === true ? "text-ciano" : "text-neutral-400")}
            strokeWidth={2.4}
            aria-hidden
          />
        )}
        {confirmado === true ? "Presença confirmada" : "Eu vou"}
      </button>

      <button
        type="button"
        onClick={() => responder(false)}
        disabled={salvando}
        aria-pressed={confirmado === false}
        className={cn(
          "flex h-12 items-center justify-center gap-1.5 rounded-full px-5 text-[15px] font-medium transition-all duration-200 active:scale-[.98] disabled:opacity-70",
          confirmado === false
            ? "bg-neutral-100 text-neutral-800 ring-1 ring-neutral-300"
            : "bg-card text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-50"
        )}
      >
        <X className="size-4" aria-hidden />
        Não vou
      </button>
    </div>
  );
}
