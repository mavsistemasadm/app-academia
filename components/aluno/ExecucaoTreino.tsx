"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Check,
  Flame,
  Loader2,
  Timer,
  Trophy,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Confete } from "@/components/shared/Confete";
import { VideoExercicio } from "@/components/shared/VideoExercicio";
import type { TreinoDoDia } from "@/lib/supabase/treino";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  ehColunaInexistente,
  formatarCronometro,
  formatarDuracao,
} from "@/lib/utils/duracao";

interface ExecucaoTreinoProps {
  alunoId: string;
  treino: TreinoDoDia;
  /** Data da academia, `YYYY-MM-DD` — calculada no servidor. */
  hoje: string;
}

/** Degradê da marca — o mesmo do card de check-in. */
const DEGRADE_CIANO =
  "bg-[linear-gradient(135deg,#0a8fa3_0%,#00a9bf_55%,#1cc3d8_100%)]";
const DEGRADE_VERDE = "bg-[linear-gradient(135deg,#15803d_0%,#16a34a_100%)]";

/** Chave do conjunto de séries feitas: `<exercicioId>:<serie>`. */
function chave(exercicioId: string, serie: number) {
  return `${exercicioId}:${serie}`;
}

interface Comemoracao {
  segundos: number | null;
  series: number;
  total: number;
  esforco: number;
}

export function ExecucaoTreino({ alunoId, treino, hoje }: ExecucaoTreinoProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [feitas, setFeitas] = useState(() => {
    const inicial = new Set<string>();
    for (const e of treino.exercicios) {
      for (const serie of e.seriesFeitas) inicial.add(chave(e.id, serie));
    }
    return inicial;
  });

  const [execucaoId, setExecucaoId] = useState(treino.execucaoId);
  const [concluido, setConcluido] = useState(treino.concluido);
  const [esforcoSalvo, setEsforcoSalvo] = useState(treino.esforcoPercebido);
  /** Instante de início vindo do banco — o cronômetro é sempre `agora - inicio`. */
  const [inicio, setInicio] = useState(treino.inicioEm);
  const [duracaoFinal, setDuracaoFinal] = useState(treino.duracaoSegundos);
  const [comemoracao, setComemoracao] = useState<Comemoracao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [heroVisivel, setHeroVisivel] = useState(true);
  const [, iniciarTransicao] = useTransition();

  const heroRef = useRef<HTMLElement>(null);
  /** Espelho de `inicio` para os handlers assíncronos, que veriam estado velho. */
  const inicioRef = useRef(treino.inicioEm);

  // A barrinha fixa só aparece quando o cartão-herói sai da tela.
  useEffect(() => {
    const alvo = heroRef.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      ([entrada]) => setHeroVisivel(entrada.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" }
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  /*
    Marcar duas séries em sequência rápida dispararia dois upserts de
    `treino_execucoes`. Guardar a promessa faz a segunda chamada esperar a
    primeira em vez de criar outra execução.
  */
  const execucaoPendente = useRef<Promise<string | null> | null>(null);

  async function garantirExecucao(): Promise<string | null> {
    if (execucaoId) return execucaoId;
    if (execucaoPendente.current) return execucaoPendente.current;

    const promessa = (async () => {
      // A execução nasce na primeira série: é aqui que o relógio começa.
      const agora = new Date().toISOString();
      const base = { treino_id: treino.id, aluno_id: alunoId, data: hoje };

      const criar = (linha: Record<string, unknown>) =>
        supabase
          .from("treino_execucoes")
          .upsert(linha, { onConflict: "treino_id,aluno_id,data" })
          .select("*")
          .single();

      let resposta = await criar({ ...base, iniciado_em: agora });
      // Migração 008 ainda não aplicada: grava sem a coluna nova.
      if (resposta.error && ehColunaInexistente(resposta.error)) {
        resposta = await criar(base);
      }

      execucaoPendente.current = null;

      const { data, error } = resposta;
      if (error || !data) return null;

      const inicioGravado =
        (data.iniciado_em as string | null | undefined) ??
        (data.created_at as string | null | undefined) ??
        agora;
      if (!inicioRef.current) {
        inicioRef.current = inicioGravado;
        setInicio(inicioGravado);
      }
      setExecucaoId(data.id);
      return data.id as string;
    })();

    execucaoPendente.current = promessa;
    return promessa;
  }

  async function alternarSerie(exercicioId: string, serie: number) {
    const id = chave(exercicioId, serie);
    const marcando = !feitas.has(id);

    // Otimista: o toque tem que responder na hora, mesmo em 3G ruim.
    setFeitas((atuais) => {
      const proximo = new Set(atuais);
      if (marcando) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
    setErro(null);
    if (marcando) navigator.vibrate?.(25);

    const execucao = await garantirExecucao();

    if (!execucao) {
      desfazer(id, marcando);
      setErro("Não conseguimos registrar. Verifique sua conexão.");
      return;
    }

    const { error } = marcando
      ? await supabase.from("exercicio_execucoes").upsert(
          {
            execucao_id: execucao,
            exercicio_id: exercicioId,
            aluno_id: alunoId,
            serie,
          },
          { onConflict: "execucao_id,exercicio_id,serie" }
        )
      : await supabase
          .from("exercicio_execucoes")
          .delete()
          .eq("execucao_id", execucao)
          .eq("exercicio_id", exercicioId)
          .eq("serie", serie);

    if (error) {
      desfazer(id, marcando);
      setErro("Não conseguimos registrar. Verifique sua conexão.");
    }
  }

  function desfazer(id: string, marcava: boolean) {
    setFeitas((atuais) => {
      const proximo = new Set(atuais);
      if (marcava) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  async function finalizar(esforco: number, observacao: string) {
    const execucao = await garantirExecucao();
    if (!execucao) return false;

    const fim = new Date();
    const inicioMs = inicioRef.current ? Date.parse(inicioRef.current) : NaN;
    const segundos = Number.isFinite(inicioMs)
      ? Math.max(0, Math.round((fim.getTime() - inicioMs) / 1000))
      : null;

    const base = {
      concluido: true,
      esforco_percebido: esforco,
      observacao: observacao.trim() || null,
    };

    const atualizar = (campos: Record<string, unknown>) =>
      supabase.from("treino_execucoes").update(campos).eq("id", execucao);

    let { error } = await atualizar({
      ...base,
      concluido_em: fim.toISOString(),
      duracao_segundos: segundos,
    });
    // Sem a migração 008 o update com as colunas novas falha: refaz sem elas.
    if (error && ehColunaInexistente(error)) {
      ({ error } = await atualizar(base));
    }

    if (error) return false;

    setConcluido(true);
    setEsforcoSalvo(esforco);
    setDuracaoFinal(segundos);
    setDialogoAberto(false);
    setComemoracao({
      segundos,
      series: feitas.size,
      total: treino.totalSeries,
      esforco,
    });
    navigator.vibrate?.([40, 60, 40]);
    iniciarTransicao(() => router.refresh());
    return true;
  }

  const total = treino.totalSeries;
  const progresso = total > 0 ? Math.round((feitas.size / total) * 100) : 0;
  const tudoFeito = feitas.size >= total && total > 0;

  const completoPorExercicio = treino.exercicios.map((e) =>
    Array.from({ length: e.series }, (_, i) => i + 1).every((s) =>
      feitas.has(chave(e.id, s))
    )
  );
  const indiceAtual = concluido
    ? -1
    : completoPorExercicio.findIndex((completo) => !completo);

  const diaDaSemana = format(new Date(`${hoje}T12:00:00Z`), "EEEE", {
    locale: ptBR,
  });

  function irParaAtual() {
    const alvo = treino.exercicios[indiceAtual === -1 ? 0 : indiceAtual];
    if (!alvo) return;
    document
      .getElementById(`exercicio-${alvo.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Cartão-herói ─────────────────────────────────────────── */}
      <section
        ref={heroRef}
        aria-label="Progresso do treino"
        className={cn(
          "relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_20px_44px_-20px_rgba(0,150,170,.8)] md:p-7",
          DEGRADE_CIANO
        )}
      >
        {!concluido && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-brilho bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/15 blur-2xl"
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="rotulo text-white/80">Treino de {diaDaSemana}</p>
            <h2 className="mt-1.5 font-display text-[24px] leading-tight font-semibold tracking-[-0.025em] text-white md:text-[28px]">
              {treino.nome}
            </h2>
          </div>

          <span
            className={cn(
              "mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
              concluido ? "bg-white text-saude-verde" : "bg-white/20 text-white"
            )}
          >
            {concluido ? (
              <>
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
                Concluído
              </>
            ) : inicio ? (
              <>
                <span className="size-2 animate-pulso-ponto rounded-full bg-white" />
                Em andamento
              </>
            ) : (
              <>
                <Flame className="size-3.5" aria-hidden />
                Pronto?
              </>
            )}
          </span>
        </div>

        <div className="relative mt-5 flex items-center gap-4">
          <AnelProgresso progresso={progresso} concluido={concluido} />

          <div className="min-w-0 flex-1">
            <p className="rotulo flex items-center gap-1.5 text-white/80">
              <Timer className="size-3.5" aria-hidden />
              {concluido ? "Tempo total" : "Tempo de treino"}
            </p>
            <p className="numero mt-1.5 text-[40px] leading-none font-semibold text-white md:text-[46px]">
              <Cronometro
                inicio={inicio}
                segundosFinais={concluido ? duracaoFinal : null}
                concluido={concluido}
              />
            </p>
            <p className="mt-2 text-sm text-white/90">
              <span className="numero font-semibold text-white">
                {feitas.size}
              </span>{" "}
              de <span className="numero">{total}</span> séries
              {concluido && esforcoSalvo != null && (
                <>
                  {" · "}esforço{" "}
                  <span className="numero font-semibold text-white">
                    {esforcoSalvo}
                  </span>
                  /10
                </>
              )}
            </p>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuenow={concluido ? 100 : progresso}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Séries feitas"
          className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/25"
        >
          <div
            className="h-full rounded-full bg-white transition-[width] duration-300"
            style={{ width: `${concluido ? 100 : progresso}%` }}
          />
        </div>

        <div className="relative mt-5">
          {concluido ? (
            <Link
              href="/home"
              className="group flex h-12 items-center justify-between rounded-full bg-white pr-2 pl-5 text-[15px] font-semibold text-primary shadow-[0_10px_24px_-10px_rgba(4,40,46,.5)] transition-transform duration-200 active:scale-[.98]"
            >
              Voltar ao início
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-white",
                  DEGRADE_CIANO
                )}
              >
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() =>
                tudoFeito ? setDialogoAberto(true) : irParaAtual()
              }
              className="group flex h-12 w-full items-center justify-between rounded-full bg-white pr-2 pl-5 text-[15px] font-semibold text-primary shadow-[0_10px_24px_-10px_rgba(4,40,46,.5)] transition-transform duration-200 active:scale-[.98]"
            >
              {tudoFeito
                ? "Concluir treino"
                : feitas.size === 0
                  ? "Começar treino"
                  : "Ir para a próxima série"}
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-white",
                  tudoFeito ? DEGRADE_VERDE : DEGRADE_CIANO
                )}
              >
                {tudoFeito ? (
                  <Trophy className="size-4" aria-hidden />
                ) : (
                  <ArrowDown
                    className="size-4 transition-transform group-hover:translate-y-0.5"
                    aria-hidden
                  />
                )}
              </span>
            </button>
          )}
        </div>
      </section>

      {/* ── Barrinha fixa: tempo e séries quando o herói sai da tela ── */}
      <div className="pointer-events-none sticky top-3 z-20 -my-2 h-0">
        <div
          aria-hidden={heroVisivel}
          className={cn(
            "flex h-12 items-center gap-3 rounded-full pr-4 pl-1.5 text-white shadow-[0_14px_30px_-14px_rgba(0,120,140,.9)] transition-all duration-300",
            concluido ? DEGRADE_VERDE : DEGRADE_CIANO,
            heroVisivel
              ? "-translate-y-3 opacity-0"
              : "pointer-events-auto translate-y-0 opacity-100"
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            {concluido ? (
              <Check className="size-4" strokeWidth={3} aria-hidden />
            ) : (
              <Timer className="size-4" aria-hidden />
            )}
          </span>
          <span className="numero text-lg font-semibold">
            <Cronometro
              inicio={inicio}
              segundosFinais={concluido ? duracaoFinal : null}
              concluido={concluido}
            />
          </span>
          <span className="ml-auto text-sm text-white/90">
            <span className="numero font-semibold text-white">
              {feitas.size}
            </span>
            /<span className="numero">{total}</span> séries
          </span>
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/25">
            <span
              className="block h-full rounded-full bg-white transition-[width] duration-300"
              style={{ width: `${concluido ? 100 : progresso}%` }}
            />
          </span>
        </div>
      </div>

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 px-1 text-sm text-saude-vermelho"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      {/* ── Exercícios ───────────────────────────────────────────── */}
      <ol className="flex flex-col gap-3">
        {treino.exercicios.map((exercicio, indice) => {
          const completo = completoPorExercicio[indice];
          const atual = indice === indiceAtual;

          const detalhes = [
            { rotulo: "Séries", valor: String(exercicio.series) },
            exercicio.repeticoes && {
              rotulo: "Repetições",
              valor: exercicio.repeticoes,
            },
            exercicio.carga && { rotulo: "Carga", valor: exercicio.carga },
            exercicio.descanso && {
              rotulo: "Descanso",
              valor: exercicio.descanso,
            },
          ].filter(Boolean) as { rotulo: string; valor: string }[];

          return (
            <li
              key={exercicio.id}
              id={`exercicio-${exercicio.id}`}
              className={cn(
                "flex scroll-mt-20 flex-col gap-4 rounded-2xl p-4 transition-all duration-300 md:p-5",
                completo
                  ? "bg-[linear-gradient(180deg,#effaf3_0%,#ffffff_70%)] ring-1 ring-saude-verde/30"
                  : atual
                    ? "bg-card shadow-[0_16px_36px_-22px_rgba(0,150,170,.75)] ring-2 ring-ciano/70"
                    : "bg-card ring-1 ring-neutral-200/90"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "numero flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    completo
                      ? "bg-saude-verde text-white"
                      : atual
                        ? cn(DEGRADE_CIANO, "text-white")
                        : "bg-ciano/10 text-primary"
                  )}
                  aria-hidden
                >
                  {completo ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : (
                    indice + 1
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="pt-0.5 text-lg leading-snug font-semibold tracking-[-0.02em] text-neutral-950">
                      {exercicio.nome}
                    </h3>
                    {completo ? (
                      <span className="mt-1 flex shrink-0 items-center gap-1 rounded-full bg-saude-verde-light px-2.5 py-0.5 text-[11px] font-semibold text-saude-verde">
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                        Feito
                      </span>
                    ) : (
                      atual && (
                        <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-ciano/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                          <span className="size-1.5 rounded-full bg-ciano" />
                          Agora
                        </span>
                      )
                    )}
                  </div>

                  {exercicio.observacoes && (
                    <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
                      {exercicio.observacoes}
                    </p>
                  )}
                </div>
              </div>

              <dl className="flex flex-wrap gap-x-6 gap-y-3">
                {detalhes.map(({ rotulo, valor }) => (
                  <div key={rotulo} className="min-w-0">
                    <dt className="rotulo text-neutral-400">{rotulo}</dt>
                    <dd className="numero mt-1 truncate text-xl leading-none font-semibold text-neutral-950">
                      {valor}
                    </dd>
                  </div>
                ))}
              </dl>

              <VideoExercicio url={exercicio.videoUrl} nome={exercicio.nome} />

              {/* Um botão por série — o toque é grande de propósito. */}
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: exercicio.series }, (_, i) => i + 1).map(
                  (serie) => {
                    const marcada = feitas.has(chave(exercicio.id, serie));

                    return (
                      <button
                        key={serie}
                        type="button"
                        onClick={() => alternarSerie(exercicio.id, serie)}
                        aria-pressed={marcada}
                        aria-label={`Série ${serie} de ${exercicio.nome}`}
                        className={cn(
                          "numero flex h-12 min-w-16 items-center justify-center gap-1.5 rounded-full px-4 text-base font-semibold transition-all duration-200 active:scale-[.96]",
                          marcada
                            ? completo
                              ? "bg-saude-verde text-white shadow-[0_8px_18px_-10px_rgba(22,163,74,.9)]"
                              : cn(
                                  DEGRADE_CIANO,
                                  "text-white shadow-[0_8px_18px_-10px_rgba(0,150,170,.9)]"
                                )
                            : "bg-white text-primary ring-1 ring-ciano/35 hover:bg-ciano/5"
                        )}
                      >
                        {marcada && (
                          <Check
                            className="size-4"
                            strokeWidth={3}
                            aria-hidden
                          />
                        )}
                        {serie}ª
                      </button>
                    );
                  }
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* ── Finalizar ────────────────────────────────────────────── */}
      {!concluido && (
        <button
          type="button"
          onClick={() => setDialogoAberto(true)}
          disabled={feitas.size === 0}
          className={cn(
            "relative mt-2 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-full text-base font-semibold text-white transition-all duration-200 active:scale-[.98] disabled:pointer-events-none disabled:opacity-45",
            tudoFeito
              ? cn(
                  DEGRADE_VERDE,
                  "animate-pulso-ponto shadow-[0_16px_34px_-16px_rgba(22,163,74,.9)]"
                )
              : cn(DEGRADE_CIANO, "shadow-[0_16px_34px_-18px_rgba(0,150,170,.8)]")
          )}
        >
          {tudoFeito && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-brilho bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          )}
          <Trophy className="relative size-5" aria-hidden />
          <span className="relative">
            {tudoFeito ? "Concluir treino" : "Encerrar treino por aqui"}
          </span>
        </button>
      )}

      <DialogEsforco
        aberto={dialogoAberto}
        onAbertoChange={setDialogoAberto}
        parcial={!tudoFeito}
        restantes={total - feitas.size}
        onConfirmar={finalizar}
      />

      {comemoracao && (
        <ComemoracaoTreino
          {...comemoracao}
          aoFechar={() => setComemoracao(null)}
        />
      )}
    </div>
  );
}

/**
 * Relógio vivo. Nunca conta a partir de estado local: é sempre
 * `agora - inicio`, então recarregar a página não zera nada.
 */
function Cronometro({
  inicio,
  segundosFinais,
  concluido,
}: {
  inicio: string | null;
  segundosFinais: number | null;
  concluido: boolean;
}) {
  const rodando = Boolean(inicio) && !concluido;
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    if (!rodando) return;
    const tique = () => setAgora(Date.now());
    const primeiro = window.setTimeout(tique, 0);
    const intervalo = window.setInterval(tique, 1000);
    return () => {
      window.clearTimeout(primeiro);
      window.clearInterval(intervalo);
    };
  }, [rodando]);

  let texto = "00:00";
  if (concluido) {
    texto = segundosFinais != null ? formatarCronometro(segundosFinais) : "--:--";
  } else if (inicio && agora != null) {
    texto = formatarCronometro((agora - Date.parse(inicio)) / 1000);
  }

  return (
    <span role="timer" aria-live="off" suppressHydrationWarning>
      {texto}
    </span>
  );
}

/** Anel branco sobre o degradê ciano. */
function AnelProgresso({
  progresso,
  concluido,
}: {
  progresso: number;
  concluido: boolean;
}) {
  const raio = 30;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = concluido ? 100 : progresso;

  return (
    <div className="relative size-[76px] shrink-0" aria-hidden>
      <svg viewBox="0 0 72 72" className="size-[76px] -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={raio}
          fill="none"
          stroke="rgba(255,255,255,.28)"
          strokeWidth="6"
        />
        <circle
          cx="36"
          cy="36"
          r={raio}
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - preenchido / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="numero absolute inset-0 flex items-center justify-center text-[15px] font-semibold text-white">
        {concluido ? (
          <Check className="size-7" strokeWidth={3} />
        ) : (
          `${progresso}%`
        )}
      </span>
    </div>
  );
}

/** Escala de 1 a 10; a palavra ajuda quem não pensa em número. */
const ESFORCOS = Array.from({ length: 10 }, (_, i) => i + 1);

function descreverEsforco(valor: number): string {
  if (valor <= 2) return "Muito leve";
  if (valor <= 4) return "Leve";
  if (valor <= 6) return "Moderado";
  if (valor <= 8) return "Puxado";
  return "Máximo";
}

function fraseDoTreino(esforco: number, parcial: boolean): string {
  if (parcial) return "Fez o que dava hoje, e isso conta. Amanhã tem mais.";
  if (esforco >= 9) return "Deu tudo de si. Agora é água e um bom descanso.";
  if (esforco >= 7) return "Treino puxado e concluído. É assim que o corpo evolui.";
  if (esforco >= 4) return "Constância vence intensidade. Mais um treino no bolso.";
  return "Leve também é treino. O importante é ter vindo se cuidar.";
}

function DialogEsforco({
  aberto,
  onAbertoChange,
  parcial,
  restantes,
  onConfirmar,
}: {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  parcial: boolean;
  restantes: number;
  onConfirmar: (esforco: number, observacao: string) => Promise<boolean>;
}) {
  const [esforco, setEsforco] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (esforco === null) {
      setErro("Escolha o quanto o treino exigiu de você.");
      return;
    }

    setSalvando(true);
    setErro(null);

    const deuCerto = await onConfirmar(esforco, observacao);

    setSalvando(false);
    if (!deuCerto) setErro("Não conseguimos salvar. Tente de novo.");
  }

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-neutral-950">
            Como foi o treino?
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-neutral-500">
            {parcial
              ? `Faltaram ${restantes} ${restantes === 1 ? "série" : "séries"}. Sem problema, conte o esforço do que você fez.`
              : "Seu professor usa essa nota para ajustar a próxima semana."}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="sr-only">Esforço de 1 a 10</legend>

          <div className="flex items-baseline justify-between gap-3">
            <span className="rotulo text-neutral-400">Esforço</span>
            <span className="text-sm text-neutral-500">
              {esforco === null ? (
                "Escolha de 1 a 10"
              ) : (
                <>
                  <span className="numero text-lg font-semibold text-primary">
                    {esforco}
                  </span>
                  <span className="text-neutral-400">/10</span> ·{" "}
                  {descreverEsforco(esforco)}
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {ESFORCOS.map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setEsforco(valor)}
                aria-pressed={esforco === valor}
                aria-label={`${valor} de 10: ${descreverEsforco(valor)}`}
                disabled={salvando}
                className={cn(
                  "numero flex h-12 items-center justify-center rounded-full text-base font-semibold transition-all duration-200 active:scale-[.96] disabled:opacity-60",
                  esforco === valor
                    ? cn(
                        DEGRADE_CIANO,
                        "text-white shadow-[0_8px_18px_-10px_rgba(0,150,170,.9)]"
                      )
                    : "bg-white text-primary ring-1 ring-ciano/35 hover:bg-ciano/5"
                )}
              >
                {valor}
              </button>
            ))}
          </div>

          <div className="flex justify-between px-1 text-[13px] text-neutral-400">
            <span>Muito leve</span>
            <span>Máximo</span>
          </div>
        </fieldset>

        <textarea
          rows={2}
          maxLength={280}
          placeholder="Alguma dor, dificuldade ou observação? (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          disabled={salvando}
          className="w-full resize-none rounded-[14px] bg-transparent px-3.5 py-3 text-base ring-1 ring-neutral-200 outline-none placeholder:text-neutral-400 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        />

        {erro && (
          <p role="alert" className="text-sm text-saude-vermelho">
            {erro}
          </p>
        )}

        <button
          type="button"
          onClick={confirmar}
          disabled={salvando}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(22,163,74,.9)] transition-all duration-200 active:scale-[.98] disabled:opacity-70",
            DEGRADE_VERDE
          )}
        >
          {salvando ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Salvando...
            </>
          ) : (
            <>
              <Trophy className="size-5" aria-hidden />
              Concluir treino
            </>
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
}

/** Tela de comemoração — no espírito da do check-in, em ciano vivo. */
function ComemoracaoTreino({
  segundos,
  series,
  total,
  esforco,
  aoFechar,
}: Comemoracao & { aoFechar: () => void }) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const parcial = series < total;

  return (
    <>
      <Confete />
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-[#04313a]/55 p-4 backdrop-blur-sm sm:items-center"
        onClick={aoFechar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="comemoracao-treino-titulo"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm animate-surgir overflow-hidden rounded-[30px] bg-[linear-gradient(160deg,#077d8f_0%,#0a8fa3_45%,#00a9bf_100%)] p-7 pb-6 text-center text-white shadow-[0_40px_90px_-20px_rgba(0,90,105,.7)]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-brilho bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.28),transparent_65%)]"
          />

          {/* Check que se desenha, com anel pulsando em volta. */}
          <div className="relative mx-auto flex size-20 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 animate-pulso-anel rounded-full bg-white/45"
            />
            <span className="relative flex size-20 items-center justify-center rounded-full bg-white shadow-[0_0_40px_rgba(255,255,255,.45)]">
              <svg viewBox="0 0 24 24" className="size-10" aria-hidden>
                <path
                  d="M5.5 12.5l4 4 9-9"
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="26"
                  className="animate-tracar"
                />
              </svg>
            </span>
          </div>

          <p className="rotulo relative mt-6 text-white/80">Treino concluído</p>
          <h2
            id="comemoracao-treino-titulo"
            className="relative mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-white"
          >
            {parcial ? "Mandou bem hoje!" : "Treino no bolso!"}
          </h2>

          <div className="relative mt-5">
            <p className="numero text-[60px] leading-none font-semibold text-white">
              {segundos != null ? formatarCronometro(segundos) : "--:--"}
            </p>
            <p className="mt-2 text-sm text-white/80">
              {segundos != null
                ? `${formatarDuracao(segundos)} de treino`
                : "tempo de treino"}
            </p>
          </div>

          <dl className="relative mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/15 px-3 py-3">
              <dt className="rotulo text-white/75">Séries</dt>
              <dd className="numero mt-1 text-2xl leading-none font-semibold text-white">
                {series}
                <span className="ml-0.5 font-sans text-sm font-medium tracking-normal text-white/70">
                  /{total}
                </span>
              </dd>
            </div>
            <div className="rounded-2xl bg-white/15 px-3 py-3">
              <dt className="rotulo text-white/75">Esforço</dt>
              <dd className="numero mt-1 text-2xl leading-none font-semibold text-white">
                {esforco}
                <span className="ml-0.5 font-sans text-sm font-medium tracking-normal text-white/70">
                  /10
                </span>
              </dd>
              <p className="mt-1 text-[13px] text-white/80">
                {descreverEsforco(esforco)}
              </p>
            </div>
          </dl>

          <p className="relative mx-auto mt-4 max-w-[30ch] text-[15px] leading-relaxed text-white/90">
            {fraseDoTreino(esforco, parcial)}
          </p>

          <div className="relative mt-6 flex flex-col gap-2">
            <Link
              href="/home"
              onClick={aoFechar}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-primary shadow-[0_10px_24px_-10px_rgba(4,40,46,.5)] transition-transform duration-200 active:scale-[.98]"
            >
              Voltar ao início
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={aoFechar}
              autoFocus
              className="flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-white/85 transition-colors hover:text-white"
            >
              Ver o resumo do treino
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
