"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, Flame, Loader2, LogOut, MapPin, Users } from "lucide-react";

import { Confete } from "@/components/shared/Confete";
import type { Checkin } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { naAcademia } from "@/lib/utils/datas";

interface BotaoCheckinProps {
  alunoId: string;
  hoje: string;
  checkinInicial: Checkin | null;
  presentesAgora: number;
  /** Dias seguidos de presença, como o servidor calculou (inclui hoje se já veio). */
  sequencia?: number;
  primeiroNome?: string;
  temTreinoHoje?: boolean;
}

/** Frase da comemoração: muda conforme a sequência cresce. */
function fraseDeIncentivo(dias: number) {
  if (dias >= 20) return "Isso já é estilo de vida. Orgulho de ter você aqui todo dia.";
  if (dias >= 10) return "Dez dias ou mais de atitude. Os números da sua saúde sentem isso.";
  if (dias >= 5) return "Uma semana de constância. É assim que o corpo muda de verdade.";
  if (dias >= 2) return "Voltar é o que faz a diferença. Continue nesse ritmo.";
  return "Todo começo conta. Hoje você escolheu se cuidar.";
}

export function BotaoCheckin({
  alunoId,
  hoje,
  checkinInicial,
  presentesAgora,
  sequencia = 0,
  primeiroNome,
  temTreinoHoje = false,
}: BotaoCheckinProps) {
  const router = useRouter();
  const [checkin, setCheckin] = useState(checkinInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [comemoracao, setComemoracao] = useState<{ dias: number; hora: string } | null>(null);
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

    const novo = data as Checkin;
    setCheckin(novo);
    // Sem check-in antes, a sequência do servidor parava em ontem: hoje soma um.
    setComemoracao({
      dias: checkinInicial ? Math.max(1, sequencia) : sequencia + 1,
      hora: format(naAcademia(novo.entrada), "HH:mm"),
    });
    navigator.vibrate?.([40, 60, 40]);
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
    <>
      {!checkin ? (
        /* ── Ainda não chegou: o convite que chama atenção ────────────── */
        <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#0a8fa3_0%,#00a9bf_55%,#1cc3d8_100%)] p-5 text-white shadow-[0_20px_44px_-20px_rgba(0,150,170,.8)]">
          {/* Faixa de brilho que atravessa o card de tempos em tempos. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-brilho bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-white/15 blur-2xl"
          />

          <div className="relative flex items-center gap-4">
            <button
              type="button"
              onClick={entrar}
              disabled={salvando}
              aria-label="Fazer check-in agora"
              className="group relative flex size-[76px] shrink-0 items-center justify-center rounded-full bg-white text-[#0a8fa3] shadow-[0_10px_24px_-8px_rgba(4,40,46,.55)] transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <span aria-hidden className="absolute inset-0 animate-pulso-anel rounded-full bg-white/70" />
              <span
                aria-hidden
                className="absolute inset-0 animate-pulso-anel rounded-full bg-white/50 [animation-delay:1.2s]"
              />
              {salvando ? (
                <Loader2 className="relative size-8 animate-spin" aria-hidden />
              ) : (
                <MapPin className="relative size-8" strokeWidth={2.2} aria-hidden />
              )}
            </button>

            <div className="min-w-0">
              <p className="rotulo text-white/75">Check-in</p>
              <p className="mt-1 font-display text-[22px] leading-tight font-semibold tracking-[-0.025em]">
                Chegou na academia?
              </p>
              <p className="mt-1 text-sm text-white/85">Toque no botão assim que entrar.</p>
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            {sequencia > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[13px] font-medium">
                <Flame className="size-3.5" aria-hidden />
                {sequencia} {sequencia === 1 ? "dia seguido" : "dias seguidos"}
              </span>
            )}
            {presentesAgora > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[13px] font-medium">
                <Users className="size-3.5" aria-hidden />
                {presentesAgora} treinando agora
              </span>
            )}
            <button
              type="button"
              onClick={entrar}
              disabled={salvando}
              className="ml-auto flex h-11 items-center gap-1.5 rounded-full bg-grafite px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              {salvando ? "Registrando..." : "Cheguei"}
              {!salvando && <ArrowRight className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      ) : (
        /* ── Já chegou (ou já foi embora): discreto ───────────────────── */
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 pl-4 ring-1 ring-neutral-200/90">
          <span
            className={`relative flex size-10 shrink-0 items-center justify-center rounded-full ${
              dentro ? "bg-saude-verde-light text-saude-verde" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            <MapPin className="size-[18px]" aria-hidden />
            {dentro && (
              <span className="absolute top-0 right-0 size-2.5 animate-pulso-ponto rounded-full border-2 border-white bg-saude-verde" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-neutral-950">
              {dentro ? "Você está na academia" : "Treino de hoje encerrado"}
            </p>
            <p className="truncate text-[13px] text-neutral-500">
              {dentro
                ? `Entrada às ${format(naAcademia(checkin.entrada), "HH:mm")}${
                    sequencia > 1 ? ` · ${sequencia} dias seguidos` : ""
                  }`
                : `${format(naAcademia(checkin.entrada), "HH:mm")} às ${format(naAcademia(checkin.saida!), "HH:mm")} · bom trabalho!`}
            </p>
          </div>

          {dentro && (
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
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}

      {comemoracao && (
        <Comemoracao
          {...comemoracao}
          primeiroNome={primeiroNome}
          presentesAgora={presentesAgora}
          temTreinoHoje={temTreinoHoje}
          aoFechar={() => setComemoracao(null)}
        />
      )}
    </>
  );
}

function Comemoracao({
  dias,
  hora,
  primeiroNome,
  presentesAgora,
  temTreinoHoje,
  aoFechar,
}: {
  dias: number;
  hora: string;
  primeiroNome?: string;
  presentesAgora: number;
  temTreinoHoje: boolean;
  aoFechar: () => void;
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  return (
    <>
      <Confete />
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-grafite/60 p-4 backdrop-blur-sm sm:items-center"
        onClick={aoFechar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="comemoracao-titulo"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm animate-surgir overflow-hidden rounded-[30px] bg-grafite p-7 pb-6 text-center text-white shadow-[0_40px_90px_-20px_rgba(0,0,0,.6)] ring-1 ring-white/10"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,180,203,.35),transparent_65%)]"
          />

          {/* Check que se desenha, com anéis pulsando em volta. */}
          <div className="relative mx-auto flex size-20 items-center justify-center">
            <span aria-hidden className="absolute inset-0 animate-pulso-anel rounded-full bg-ciano/40" />
            <span className="relative flex size-20 items-center justify-center rounded-full bg-ciano shadow-[0_0_40px_rgba(0,180,203,.55)]">
              <svg viewBox="0 0 24 24" className="size-10" aria-hidden>
                <path
                  d="M5.5 12.5l4 4 9-9"
                  fill="none"
                  stroke="#0F1618"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="26"
                  className="animate-tracar"
                />
              </svg>
            </span>
          </div>

          <p className="rotulo relative mt-6 text-[#5fd3e2]">Check-in às {hora}</p>
          <h2
            id="comemoracao-titulo"
            className="relative mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em]"
          >
            {primeiroNome ? `Boa, ${primeiroNome}!` : "Check-in feito!"}
          </h2>

          <div className="relative mt-5 flex items-center justify-center gap-3">
            <span className="numero text-[56px] leading-none font-semibold text-white">{dias}</span>
            <span className="text-left text-sm leading-snug text-white/70">
              {dias === 1 ? (
                <>
                  primeiro dia
                  <br />
                  da sequência
                </>
              ) : (
                <>
                  dias seguidos
                  <br />
                  de atitude
                </>
              )}
            </span>
          </div>

          <p className="relative mx-auto mt-4 max-w-[30ch] text-[15px] leading-relaxed text-white/75">
            {fraseDeIncentivo(dias)}
          </p>

          {presentesAgora > 0 && (
            <p className="relative mt-3 text-[13px] text-white/50">
              Você e mais {presentesAgora} {presentesAgora === 1 ? "pessoa treinando" : "pessoas treinando"} agora.
            </p>
          )}

          <div className="relative mt-6 flex flex-col gap-2">
            {temTreinoHoje && (
              <Link
                href="/treino"
                onClick={aoFechar}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-ciano text-[15px] font-semibold text-grafite transition-colors hover:bg-[#2cc4d8]"
              >
                Ver meu treino de hoje
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
            <button
              type="button"
              onClick={aoFechar}
              autoFocus
              className={`flex h-12 items-center justify-center rounded-full text-[15px] font-semibold transition-colors ${
                temTreinoHoje
                  ? "text-white/70 hover:text-white"
                  : "bg-ciano text-grafite hover:bg-[#2cc4d8]"
              }`}
            >
              {temTreinoHoje ? "Fechar" : "Bora treinar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
