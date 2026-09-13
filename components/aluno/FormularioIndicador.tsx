"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
import { FaixaSemaforo } from "@/components/shared/FaixaSemaforo";
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

const PILULA_BASE =
  "rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[.98]";
const PILULA_ATIVA = "bg-grafite text-white";
const PILULA_INATIVA = "bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100";

const CAMPO_NUMERO =
  "numero h-14 px-4 text-[26px] font-semibold text-neutral-950 placeholder:text-neutral-300 md:text-[26px]";

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
      return `Valor fora do esperado: deve ficar entre ${config.min} e ${config.max} ${config.unidade}.`;
    }

    if (tipo !== "pressao") return null;

    if (secundario === null) return "Informe também a diastólica (a menor).";

    if (
      secundario < config.minSecundario! ||
      secundario > config.maxSecundario!
    ) {
      return `Diastólica fora do esperado: deve ficar entre ${config.minSecundario} e ${config.maxSecundario} mmHg.`;
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
      setErro("Não conseguimos salvar o registro. Confira a conexão e tente de novo.");
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
      className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6"
      noValidate
    >
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
          Registrar medição
        </h2>
        <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
          Anote agora, leva menos de um minuto.
        </p>
      </div>

      {/* ── Tipo do indicador ──────────────────────────────────── */}
      <fieldset className="flex flex-col gap-2" disabled={ocupado}>
        <legend className="sr-only">O que você quer registrar</legend>

        <div className="flex flex-wrap gap-2">
          {ORDEM_INDICADORES.map((opcao) => {
            const { labelCurto } = CONFIG_INDICADORES[opcao];
            const ativo = opcao === tipo;

            return (
              <button
                key={opcao}
                type="button"
                onClick={() => trocarTipo(opcao)}
                aria-pressed={ativo}
                className={cn(
                  PILULA_BASE,
                  "h-11",
                  ativo ? PILULA_ATIVA : PILULA_INATIVA,
                  ocupado && "opacity-60"
                )}
              >
                {labelCurto}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ── Valores ────────────────────────────────────────────── */}
      <div className={cn("grid gap-4", tipo === "pressao" && "grid-cols-2 gap-3")}>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="valor" className="text-sm font-medium text-neutral-700">
            {config.labelPrincipal}
          </Label>
          <div className="relative">
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
              className={cn(CAMPO_NUMERO, "pr-16")}
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-neutral-400">
              {config.unidade}
            </span>
          </div>
        </div>

        {tipo === "pressao" && (
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="valor2" className="text-sm font-medium text-neutral-700">
              {config.labelSecundario}
            </Label>
            <div className="relative">
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
                className={cn(CAMPO_NUMERO, "pr-16")}
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-neutral-400">
                mmHg
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Momento da medição ─────────────────────────────────── */}
      {config.momentos.length > 0 && (
        <fieldset className="flex flex-col gap-2" disabled={ocupado}>
          <legend className="mb-2 text-sm font-medium text-neutral-700">
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
                    PILULA_BASE,
                    "h-10",
                    ativo ? PILULA_ATIVA : PILULA_INATIVA,
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
        <Label htmlFor="observacao" className="text-sm font-medium text-neutral-700">
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
          className="w-full resize-none rounded-[14px] border border-input bg-card px-4 py-3 text-base outline-none transition-colors placeholder:text-neutral-400 hover:border-neutral-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        />
      </div>

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}

      {salvo && <ResultadoSemaforo registro={salvo} />}

      <Button
        type="submit"
        disabled={ocupado}
        className="h-12 w-full rounded-full text-base font-semibold"
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

/** Feedback logo após salvar: valor, semáforo, faixa e o que fazer a respeito. */
function ResultadoSemaforo({ registro }: { registro: RegistroIndicador }) {
  const semaforo = SEMAFORO_CONFIG[registro.status];
  const config = CONFIG_INDICADORES[registro.tipo];

  const mensagem =
    registro.badge === "Sem altura"
      ? "Peso registrado. Sem a altura da avaliação física não dá para calcular o IMC."
      : getMensagemAlerta(
          registro.tipo,
          registro.status,
          registro.valorPrincipal,
          registro.valorSecundario ?? undefined
        ) || semaforo.mensagem;

  // Peso só ganha faixa quando há IMC; os demais usam o próprio valor.
  const valorFaixa =
    registro.tipo === "peso" ? registro.imc : registro.valorPrincipal;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-4",
        registro.status === "vermelho" ? "bg-saude-vermelho-light" : "bg-neutral-50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
          <Check className="size-4 shrink-0 text-saude-verde" strokeWidth={2.2} aria-hidden />
          {config.labelCurto} registrada
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            CHIP_SEMAFORO[registro.status]
          )}
        >
          {registro.badge || semaforo.label}
        </span>
      </div>

      <p className="numero text-[32px] leading-none font-semibold text-neutral-950">
        {registro.valorFormatado.replace(" kg", "")}
        <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
          {config.unidade}
        </span>
      </p>

      {valorFaixa != null && (
        <FaixaSemaforo
          tipo={registro.tipo}
          valor={valorFaixa}
          valorSecundario={registro.valorSecundario}
          className="my-1"
        />
      )}

      <p
        className={cn(
          "text-sm leading-relaxed",
          registro.status === "vermelho" ? "text-[#b91c1c]" : "text-neutral-600"
        )}
      >
        {mensagem}
      </p>
    </div>
  );
}
