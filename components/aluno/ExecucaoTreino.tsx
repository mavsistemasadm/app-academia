"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoExercicio } from "@/components/shared/VideoExercicio";
import type { TreinoDoDia } from "@/lib/supabase/treino";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface ExecucaoTreinoProps {
  alunoId: string;
  treino: TreinoDoDia;
  /** Data da academia, `YYYY-MM-DD` — calculada no servidor. */
  hoje: string;
}

/** Chave do conjunto de séries feitas: `<exercicioId>:<serie>`. */
function chave(exercicioId: string, serie: number) {
  return `${exercicioId}:${serie}`;
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
  const [erro, setErro] = useState<string | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [, iniciarTransicao] = useTransition();

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
      const { data, error } = await supabase
        .from("treino_execucoes")
        .upsert(
          { treino_id: treino.id, aluno_id: alunoId, data: hoje },
          { onConflict: "treino_id,aluno_id,data" }
        )
        .select("id")
        .single();

      execucaoPendente.current = null;

      if (error || !data) return null;

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

    const { error } = await supabase
      .from("treino_execucoes")
      .update({
        concluido: true,
        esforco_percebido: esforco,
        observacao: observacao.trim() || null,
      })
      .eq("id", execucao);

    if (error) return false;

    setConcluido(true);
    setEsforcoSalvo(esforco);
    setDialogoAberto(false);
    iniciarTransicao(() => router.refresh());
    return true;
  }

  const total = treino.totalSeries;
  const progresso = total > 0 ? Math.round((feitas.size / total) * 100) : 0;
  const tudoFeito = feitas.size >= total && total > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Progresso ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-neutral-200/90 shadow-[0_10px_30px_-18px_rgba(12,18,20,.3)]">
        <AnelProgresso progresso={progresso} concluido={concluido} />

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-950">
            {concluido
              ? "Treino concluído"
              : feitas.size === 0
                ? "Toque em cada série ao terminar"
                : tudoFeito
                  ? "Todas as séries feitas"
                  : "Seu progresso"}
          </p>
          <p className="mt-0.5 text-[13px] text-neutral-500">
            <span className="numero font-semibold text-neutral-950">
              {feitas.size}
            </span>{" "}
            de <span className="numero">{total}</span> séries
          </p>

          <div
            role="progressbar"
            aria-valuenow={progresso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do treino"
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200"
          >
            <div
              className="h-full rounded-full bg-ciano transition-[width] duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>

          {concluido && esforcoSalvo != null && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-saude-verde">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              Esforço {esforcoSalvo}/10 registrado. Bom trabalho!
            </p>
          )}
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
          const seriesFeitas = Array.from(
            { length: exercicio.series },
            (_, i) => i + 1
          ).filter((s) => feitas.has(chave(exercicio.id, s)));

          const completo = seriesFeitas.length === exercicio.series;

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
              className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-neutral-200/90 transition-all duration-200 md:p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "numero flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    completo
                      ? "bg-grafite text-ciano"
                      : "bg-neutral-100 text-neutral-500"
                  )}
                  aria-hidden
                >
                  {completo ? (
                    <Check className="size-4" strokeWidth={2.5} />
                  ) : (
                    indice + 1
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="pt-0.5 text-lg leading-snug font-semibold tracking-[-0.02em] text-neutral-950">
                      {exercicio.nome}
                    </h3>
                    {completo && (
                      <span className="mt-1 shrink-0 rounded-full bg-grafite px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        Feito
                      </span>
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
                          "numero flex h-12 min-w-16 items-center justify-center gap-1.5 rounded-full px-4 text-base font-semibold transition-all duration-200 active:scale-[.98]",
                          marcada
                            ? "bg-grafite text-white"
                            : "bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100"
                        )}
                      >
                        {marcada && (
                          <Check
                            className="size-4 text-ciano"
                            strokeWidth={2.5}
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
        <Button
          type="button"
          onClick={() => setDialogoAberto(true)}
          disabled={feitas.size === 0}
          className="mt-2 h-12 w-full rounded-full bg-grafite text-[15px] font-semibold text-white hover:bg-neutral-800"
        >
          {tudoFeito ? "Finalizar treino" : "Encerrar treino por aqui"}
        </Button>
      )}

      <DialogEsforco
        aberto={dialogoAberto}
        onAbertoChange={setDialogoAberto}
        parcial={!tudoFeito}
        restantes={total - feitas.size}
        onConfirmar={finalizar}
      />
    </div>
  );
}

/** Anel de progresso em SVG, no mesmo desenho do card de treino da home. */
function AnelProgresso({
  progresso,
  concluido,
}: {
  progresso: number;
  concluido: boolean;
}) {
  const raio = 23;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = concluido ? 100 : progresso;

  return (
    <div className="relative size-14 shrink-0" aria-hidden>
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={raio}
          fill="none"
          stroke="var(--color-neutral-200)"
          strokeWidth="5"
        />
        <circle
          cx="28"
          cy="28"
          r={raio}
          fill="none"
          stroke="var(--ciano)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - preenchido / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="numero absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-neutral-950">
        {concluido ? <Check className="size-5" strokeWidth={2.5} /> : `${progresso}%`}
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
              ? `Faltaram ${restantes} ${restantes === 1 ? "série" : "séries"}. Sem problema — conte o esforço do que você fez.`
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
                  <span className="numero text-lg font-semibold text-neutral-950">
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
                aria-label={`${valor} de 10 — ${descreverEsforco(valor)}`}
                disabled={salvando}
                className={cn(
                  "numero flex h-12 items-center justify-center rounded-full text-base font-semibold transition-all duration-200 active:scale-[.98] disabled:opacity-60",
                  esforco === valor
                    ? "bg-grafite text-white"
                    : "bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100"
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

        <Button
          type="button"
          onClick={confirmar}
          disabled={salvando}
          className="h-12 w-full rounded-full bg-grafite text-[15px] font-semibold text-white hover:bg-neutral-800"
        >
          {salvando ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Salvando...
            </>
          ) : (
            "Concluir treino"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
