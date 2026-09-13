"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { HumorTipo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { HUMOR_CONFIG } from "@/lib/utils/saudacao";

/** Os 5 do mockup. `HumorTipo` tem 6 — 'ansioso' não entra nesta tela. */
const OPCOES: { humor: HumorTipo; label: string }[] = [
  { humor: "otimo", label: "Ótimo" },
  { humor: "disposto", label: "Bem" },
  { humor: "cansado", label: "Cansado" },
  { humor: "dormiu_mal", label: "Dormi mal" },
  { humor: "enfermo", label: "Mal" },
];

interface RegistroHumorProps {
  alunoId: string;
  /** Data da academia, `YYYY-MM-DD` — calculada no servidor. */
  hoje: string;
  humorInicial: HumorTipo | null;
}

export function RegistroHumor({
  alunoId,
  hoje,
  humorInicial,
}: RegistroHumorProps) {
  const router = useRouter();
  const [humor, setHumor] = useState<HumorTipo | null>(humorInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciarTransicao] = useTransition();

  async function registrar(novo: HumorTipo) {
    const anterior = humor;
    setHumor(novo); // otimista — a resposta do banco não muda a escolha
    setErro(null);

    const { error } = await createClient()
      .from("humor_diario")
      .upsert(
        { aluno_id: alunoId, data: hoje, humor: novo },
        { onConflict: "aluno_id,data" }
      );

    if (error) {
      setHumor(anterior);
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }

    // Atualiza os cards que dependem do humor (acesso rápido, saudação).
    iniciarTransicao(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <h3 className="text-base font-bold text-neutral-900">
          {humor ? "Seu humor de hoje" : "Registre seu humor de hoje"}
        </h3>
        {humor && (
          <p className="mt-0.5 text-sm text-neutral-500">
            Pode trocar se mudar de ideia.
          </p>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {OPCOES.map(({ humor: opcao, label }) => {
          const selecionado = humor === opcao;

          return (
            <button
              key={opcao}
              type="button"
              onClick={() => registrar(opcao)}
              disabled={salvando}
              aria-pressed={selecionado}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition-colors",
                selecionado
                  ? "border-primary bg-primary/10"
                  : "border-neutral-200 bg-white hover:bg-neutral-50",
                salvando && "opacity-60"
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {HUMOR_CONFIG[opcao].emoji}
              </span>
              <span
                className={cn(
                  "text-center text-[11px] leading-tight font-medium",
                  selecionado ? "text-primary" : "text-neutral-500"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}
    </div>
  );
}
