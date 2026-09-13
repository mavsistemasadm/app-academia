"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, Loader2, LogOut, MapPin } from "lucide-react";

import type { Checkin } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface BotaoCheckinProps {
  alunoId: string;
  hoje: string;
  checkinInicial: Checkin | null;
  presentesAgora: number;
}

export function BotaoCheckin({
  alunoId,
  hoje,
  checkinInicial,
  presentesAgora,
}: BotaoCheckinProps) {
  const router = useRouter();
  const [checkin, setCheckin] = useState(checkinInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  async function entrar() {
    setSalvando(true);
    setErro(null);

    const { data, error } = await createClient()
      .from("checkins")
      .upsert(
        {
          aluno_id: alunoId,
          data: hoje,
          entrada: new Date().toISOString(),
          saida: null,
        },
        { onConflict: "aluno_id,data" }
      )
      .select("*")
      .single();

    setSalvando(false);

    if (error || !data) {
      setErro("Não conseguimos registrar sua chegada. Tente de novo.");
      return;
    }

    setCheckin(data as Checkin);
    iniciarTransicao(() => router.refresh());
  }

  async function sair() {
    if (!checkin) return;

    setSalvando(true);
    setErro(null);

    const saida = new Date().toISOString();

    const { error } = await createClient()
      .from("checkins")
      .update({ saida })
      .eq("id", checkin.id);

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos registrar sua saída.");
      return;
    }

    setCheckin({ ...checkin, saida });
    iniciarTransicao(() => router.refresh());
  }

  const dentro = checkin && !checkin.saida;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
            dentro
              ? "bg-saude-verde-light text-saude-verde"
              : "bg-neutral-100 text-neutral-400"
          }`}
        >
          <MapPin className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-neutral-900">
            {dentro
              ? "Você está na academia"
              : checkin?.saida
                ? "Treino de hoje encerrado"
                : "Chegou na academia?"}
          </p>
          <p className="text-sm text-neutral-500">
            {dentro
              ? `Entrada às ${format(new Date(checkin.entrada), "HH:mm")}`
              : checkin?.saida
                ? `${format(new Date(checkin.entrada), "HH:mm")} às ${format(new Date(checkin.saida), "HH:mm")}`
                : presentesAgora > 0
                  ? `${presentesAgora} ${presentesAgora === 1 ? "pessoa treinando" : "pessoas treinando"} agora`
                  : "Faça o check-in ao chegar"}
          </p>
        </div>
      </div>

      {!checkin?.saida &&
        (dentro ? (
          <button
            type="button"
            onClick={sair}
            disabled={salvando}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-base font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            {salvando ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <LogOut className="size-5" aria-hidden />
            )}
            Estou indo embora
          </button>
        ) : (
          <button
            type="button"
            onClick={entrar}
            disabled={salvando}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-saude-verde text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            {salvando ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-5" aria-hidden />
            )}
            Fazer check-in
          </button>
        ))}

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}
    </div>
  );
}
