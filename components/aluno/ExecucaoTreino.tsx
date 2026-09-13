"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Repeat,
  Weight,
} from "lucide-react";

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
    <div className="flex flex-col gap-5">
      {/* ── Progresso ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-neutral-900">
            {concluido ? "Treino concluído" : "Seu progresso"}
          </p>
          <p className="text-sm text-neutral-500 tabular-nums">
            {feitas.size} de {total} séries
          </p>
        </div>

        <div
          role="progressbar"
          aria-valuenow={progresso}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do treino"
          className="h-2 overflow-hidden rounded-full bg-neutral-100"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              concluido ? "bg-saude-verde" : "bg-primary"
            )}
            style={{ width: `${progresso}%` }}
          />
        </div>

        {concluido && esforcoSalvo != null && (
          <p className="flex items-center gap-1.5 text-sm text-saude-verde">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Esforço {esforcoSalvo}/10 registrado. Bom trabalho!
          </p>
        )}
      </div>

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-saude-vermelho-light px-3.5 py-3 text-sm text-saude-vermelho"
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
            exercicio.repeticoes && {
              icone: Repeat,
              texto: `${exercicio.repeticoes} reps`,
            },
            exercicio.carga && { icone: Weight, texto: exercicio.carga },
            exercicio.descanso && {
              icone: Clock,
              texto: `${exercicio.descanso} de descanso`,
            },
          ].filter(Boolean) as { icone: typeof Repeat; texto: string }[];

          return (
            <li
              key={exercicio.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-white p-4 transition-colors",
                completo
                  ? "border-saude-verde/40 bg-saude-verde-light/30"
                  : "border-neutral-200"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    completo
                      ? "bg-saude-verde text-white"
                      : "bg-neutral-100 text-neutral-500"
                  )}
                  aria-hidden
                >
                  {completo ? <Check className="size-4" /> : indice + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-neutral-900">
                    {exercicio.nome}
                  </h3>

                  {detalhes.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {detalhes.map(({ icone: Icone, texto }) => (
                        <li
                          key={texto}
                          className="flex items-center gap-1 text-sm text-neutral-500"
                        >
                          <Icone className="size-3.5 shrink-0" aria-hidden />
                          {texto}
                        </li>
                      ))}
                    </ul>
                  )}

                  {exercicio.observacoes && (
                    <p className="mt-1.5 text-sm text-neutral-600 italic">
                      {exercicio.observacoes}
                    </p>
                  )}
                </div>
              </div>

              <VideoExercicio url={exercicio.videoUrl} nome={exercicio.nome} />

              {/* Uma bolinha por série — o toque é grande de propósito. */}
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
                          "flex h-12 min-w-14 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors",
                          marcada
                            ? "border-saude-verde bg-saude-verde text-white"
                            : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
                        )}
                      >
                        {marcada && <Check className="size-4" aria-hidden />}
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
          className="h-14 w-full rounded-xl text-base font-semibold"
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

const ESFORCOS = [
  { valor: 2, label: "Muito leve" },
  { valor: 4, label: "Leve" },
  { valor: 6, label: "Moderado" },
  { valor: 8, label: "Puxado" },
  { valor: 10, label: "Máximo" },
];

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Como foi o treino?</DialogTitle>
          <DialogDescription>
            {parcial
              ? `Faltaram ${restantes} ${restantes === 1 ? "série" : "séries"}. Sem problema — registre o esforço do que você fez.`
              : "Seu professor usa essa nota para ajustar a próxima semana."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {ESFORCOS.map(({ valor, label }) => (
            <button
              key={valor}
              type="button"
              onClick={() => setEsforco(valor)}
              aria-pressed={esforco === valor}
              disabled={salvando}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                esforco === valor
                  ? "border-primary bg-primary/10"
                  : "border-neutral-200 hover:bg-neutral-50"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  esforco === valor ? "text-primary" : "text-neutral-700"
                )}
              >
                {label}
              </span>
              <span className="text-sm font-bold text-neutral-400 tabular-nums">
                {valor}/10
              </span>
            </button>
          ))}
        </div>

        <textarea
          rows={2}
          maxLength={280}
          placeholder="Alguma dor, dificuldade ou observação? (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          disabled={salvando}
          className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
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
          className="h-12 w-full rounded-xl text-base font-semibold"
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
