"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, Loader2, LogOut, MapPin } from "lucide-react";

import type { Checkin } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { naAcademia } from "@/lib/utils/datas";

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
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-3 pl-4 ring-1 ring-neutral-200/90">
      <div className="flex items-center gap-3">
        <span
          className={`relative flex size-10 shrink-0 items-center justify-center rounded-full ${
            dentro
              ? "bg-saude-verde-light text-saude-verde"
              : "bg-neutral-100 text-neutral-500"
          }`}
        >
          <MapPin className="size-[18px]" aria-hidden />
          {dentro && (
            <span className="absolute top-0 right-0 size-2.5 rounded-full border-2 border-white bg-saude-verde" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-950">
            {dentro
              ? "Você está na academia"
              : checkin?.saida
                ? "Treino de hoje encerrado"
                : "Chegou na academia?"}
          </p>
          <p className="truncate text-[13px] text-neutral-500">
            {dentro
              ? `Entrada às ${format(naAcademia(checkin.entrada), "HH:mm")}`
              : checkin?.saida
                ? `${format(naAcademia(checkin.entrada), "HH:mm")} às ${format(naAcademia(checkin.saida), "HH:mm")}`
                : presentesAgora > 0
                  ? `${presentesAgora} ${presentesAgora === 1 ? "pessoa treinando" : "pessoas treinando"} agora`
                  : "Faça o check-in ao chegar"}
          </p>
        </div>

        {!checkin?.saida &&
          (dentro ? (
            <button
              type="button"
              onClick={sair}
              disabled={salvando}
              className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold text-neutral-600 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
            >
              {salvando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <LogOut className="size-4" aria-hidden />
              )}
              Sair
            </button>
          ) : (
            <button
              type="button"
              onClick={entrar}
              disabled={salvando}
              className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] transition-colors hover:bg-[#0b7f91]"
            >
              {salvando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Cheguei
            </button>
          ))}
      </div>

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}
    </div>
  );
}
