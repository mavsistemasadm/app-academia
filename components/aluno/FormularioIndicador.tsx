"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Indicador, IndicadorMomento, IndicadorTipo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  CONFIG_INDICADORES,
  MOMENTO_LABEL,
  ORDEM_INDICADORES,
  lerNumero,
  resumirIndicador,
  type RegistroIndicador,
} from "@/lib/utils/indicadores";
import { SEMAFORO_CONFIG, getMensagemAlerta } from "@/lib/utils/semaforo";

const ESTILO_SEMAFORO = {
  verde: "border-saude-verde/30 bg-saude-verde-light text-saude-verde",
  amarelo: "border-saude-amarelo/30 bg-saude-amarelo-light text-saude-amarelo",
  vermelho:
    "border-saude-vermelho/30 bg-saude-vermelho-light text-saude-vermelho",
} as const;

interface FormularioIndicadorProps {
  alunoId: string;
  /** Da última avaliação física — sem ela o peso não vira IMC. */
  altura: number | null;
  tipoInicial?: IndicadorTipo;
}

export function FormularioIndicador({
  alunoId,
  altura,
  tipoInicial = "glicemia",
}: FormularioIndicadorProps) {
  const router = useRouter();

  const [tipo, setTipo] = useState<IndicadorTipo>(tipoInicial);
  const [valor, setValor] = useState("");
  const [valor2, setValor2] = useState("");
  const [momento, setMomento] = useState<IndicadorMomento | null>(null);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<RegistroIndicador | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [atualizando, iniciarTransicao] = useTransition();

  const config = CONFIG_INDICADORES[tipo];
  const ocupado = salvando || atualizando;

  function trocarTipo(novo: IndicadorTipo) {
    setTipo(novo);
    setValor("");
    setValor2("");
    setMomento(null);
    setObservacao("");
    setErro(null);
    setSalvo(null);
  }

  /** Devolve a mensagem de erro, ou `null` quando está tudo certo. */
  function validar(principal: number | null, secundario: number | null) {
    if (principal === null) return `Informe ${config.labelPrincipal.toLowerCase()}.`;

    if (principal < config.min || principal > config.max) {
      return `Valor fora do esperado — deve ficar entre ${config.min} e ${config.max} ${config.unidade}.`;
    }

    if (tipo !== "pressao") return null;

    if (secundario === null) return "Informe também a diastólica (a menor).";

    if (
      secundario < config.minSecundario! ||
      secundario > config.maxSecundario!
    ) {
      return `Diastólica fora do esperado — deve ficar entre ${config.minSecundario} e ${config.maxSecundario} mmHg.`;
    }

    if (secundario >= principal) {
      return "A diastólica precisa ser menor que a sistólica. Confira os dois números.";
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const principal = lerNumero(valor);
    const secundario = tipo === "pressao" ? lerNumero(valor2) : null;

    const problema = validar(principal, secundario);
    if (problema) {
      setErro(problema);
      setSalvo(null);
      return;
    }

    setErro(null);
    setSalvando(true);

    // O gatilho do banco grava o semáforo e, se vermelho, avisa o professor.
    const { data, error } = await createClient()
      .from("indicadores")
      .insert({
        aluno_id: alunoId,
        tipo,
        valor_principal: principal,
        valor_secundario: secundario,
        unidade: config.unidade,
        momento,
        observacao: observacao.trim() || null,
      })
      .select("*")
      .single();

    setSalvando(false);

    if (error || !data) {
      setErro("Não conseguimos salvar o registro. Tente de novo.");
      return;
    }

    setSalvo(resumirIndicador(data as Indicador, altura));
    setValor("");
    setValor2("");
    setMomento(null);
    setObservacao("");

    // Atualiza os cards do topo e o histórico logo abaixo.
    iniciarTransicao(() => router.refresh());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-4 md:p-5"
      noValidate
    >
      <div>
        <h2 className="text-base font-bold text-neutral-900">
          Registrar medição
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Anote agora — leva menos de um minuto.
        </p>
      </div>

      {/* ── Tipo do indicador ──────────────────────────────────── */}
      <fieldset className="flex flex-col gap-2" disabled={ocupado}>
        <legend className="sr-only">O que você quer registrar</legend>

        <div className="flex flex-wrap gap-2">
          {ORDEM_INDICADORES.map((opcao) => {
            const { labelCurto, icone: Icone } = CONFIG_INDICADORES[opcao];
            const ativo = opcao === tipo;

            return (
              <button
                key={opcao}
                type="button"
                onClick={() => trocarTipo(opcao)}
                aria-pressed={ativo}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
                  ativo
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                  ocupado && "opacity-60"
                )}
              >
                <Icone className="size-4" aria-hidden />
                {labelCurto}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ── Valores ────────────────────────────────────────────── */}
      <div className={cn("grid gap-4", tipo === "pressao" && "sm:grid-cols-2")}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="valor" className="text-neutral-700">
            {config.labelPrincipal}{" "}
            <span className="font-normal text-neutral-400">
              ({config.unidade})
            </span>
          </Label>
          <Input
            id="valor"
            name="valor"
            type="text"
            inputMode={config.decimal ? "decimal" : "numeric"}
            autoComplete="off"
            placeholder={config.placeholder}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={ocupado}
            required
            className="h-14 rounded-xl px-3.5 text-2xl font-semibold tabular-nums"
          />
        </div>

        {tipo === "pressao" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="valor2" className="text-neutral-700">
              {config.labelSecundario}{" "}
              <span className="font-normal text-neutral-400">(mmHg)</span>
            </Label>
            <Input
              id="valor2"
              name="valor2"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={config.placeholderSecundario}
              value={valor2}
              onChange={(e) => setValor2(e.target.value)}
              disabled={ocupado}
              required
              className="h-14 rounded-xl px-3.5 text-2xl font-semibold tabular-nums"
            />
          </div>
        )}
      </div>

      {/* ── Momento da medição ─────────────────────────────────── */}
      {config.momentos.length > 0 && (
        <fieldset className="flex flex-col gap-2" disabled={ocupado}>
          <legend className="mb-1 text-sm font-medium text-neutral-700">
            Quando você mediu?{" "}
            <span className="font-normal text-neutral-400">(opcional)</span>
          </legend>

          <div className="flex flex-wrap gap-2">
            {config.momentos.map((opcao) => {
              const ativo = momento === opcao;

              return (
                <button
                  key={opcao}
                  type="button"
                  // Clicar de novo desmarca — o campo é opcional.
                  onClick={() => setMomento(ativo ? null : opcao)}
                  aria-pressed={ativo}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm transition-colors",
                    ativo
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                    ocupado && "opacity-60"
                  )}
                >
                  {MOMENTO_LABEL[opcao]}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* ── Observação ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="observacao" className="text-neutral-700">
          Observação{" "}
          <span className="font-normal text-neutral-400">(opcional)</span>
        </Label>
        <textarea
          id="observacao"
          name="observacao"
          rows={2}
          maxLength={280}
          placeholder="Algo que o professor precisa saber?"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          disabled={ocupado}
          className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        />
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

      {salvo && <ResultadoSemaforo registro={salvo} />}

      <Button
        type="submit"
        disabled={ocupado}
        className="h-12 w-full rounded-xl text-base font-semibold"
      >
        {salvando ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Salvando...
          </>
        ) : (
          `Registrar ${config.labelCurto.toLowerCase()}`
        )}
      </Button>
    </form>
  );
}

/** Feedback logo após salvar: cor do semáforo e o que fazer a respeito. */
function ResultadoSemaforo({ registro }: { registro: RegistroIndicador }) {
  const semaforo = SEMAFORO_CONFIG[registro.status];
  const config = CONFIG_INDICADORES[registro.tipo];

  // `valorFormatado` do peso já carrega o "kg".
  const textoValor =
    registro.tipo === "peso"
      ? registro.valorFormatado
      : `${registro.valorFormatado} ${config.unidade}`;

  const mensagem =
    registro.badge === "Sem altura"
      ? "Peso registrado. Sem a altura da avaliação física não dá para calcular o IMC."
      : getMensagemAlerta(
          registro.tipo,
          registro.status,
          registro.valorPrincipal,
          registro.valorSecundario ?? undefined
        ) || semaforo.mensagem;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-1 rounded-xl border px-4 py-3.5",
        ESTILO_SEMAFORO[registro.status]
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Check className="size-4 shrink-0" aria-hidden />
        {config.labelCurto} {textoValor} · {semaforo.label}
        {registro.badge && ` · ${registro.badge}`}
      </p>
      <p className="text-sm">{mensagem}</p>
    </div>
  );
}
