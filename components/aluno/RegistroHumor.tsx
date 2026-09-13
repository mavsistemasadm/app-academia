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
    <div id="humor" className="flex h-full scroll-mt-6 flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90">
      <div>
        <p className="rotulo text-neutral-400">Como você está</p>
        <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-neutral-950">
          {humor ? "Seu humor de hoje" : "Como você acordou hoje?"}
        </h3>
        <p className="mt-0.5 text-sm text-neutral-500">
          {humor
            ? "Pode trocar se mudar de ideia."
            : "Seu professor vê e ajusta o treino se precisar."}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
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
                "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-all duration-200",
                selecionado
                  ? "bg-grafite shadow-[0_8px_20px_-10px_rgba(12,18,20,.6)]"
                  : "bg-neutral-50 hover:bg-neutral-100",
                salvando && "opacity-60"
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {HUMOR_CONFIG[opcao].emoji}
              </span>
              <span
                className={cn(
                  "text-center text-[11px] leading-tight font-medium",
                  selecionado ? "text-white" : "text-neutral-500"
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
