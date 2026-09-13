"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Indicador, IndicadorTipo, SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  CONFIG_INDICADORES,
  lerNumero,
  resumirIndicador,
} from "@/lib/utils/indicadores";
import { getMensagemAlerta, SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const ESTILO: Record<SemaforoStatus, string> = {
  verde: "border-saude-verde/40 bg-saude-verde-light/50 text-saude-verde",
  amarelo:
    "border-saude-amarelo/40 bg-saude-amarelo-light/50 text-saude-amarelo",
  vermelho:
    "border-saude-vermelho/40 bg-saude-vermelho-light/50 text-saude-vermelho",
};

interface PortaoPreTreinoProps {
  alunoId: string;
  /** O indicador que a condição clínica do aluno exige antes de treinar. */
  tipo: IndicadorTipo;
  altura: number | null;
  /** Renderizado quando o aluno é liberado para treinar. */
  children: React.ReactNode;
}

/**
 * Módulo 13 — o app pergunta o indicador crítico *antes* do treino começar.
 * No vermelho o gatilho do banco já avisa o professor; aqui o aluno vê o
 * porquê e decide com informação, em vez de ser simplesmente bloqueado.
 */
export function PortaoPreTreino({
  alunoId,
  tipo,
  altura,
  children,
}: PortaoPreTreinoProps) {
  const router = useRouter();
  const config = CONFIG_INDICADORES[tipo];

  const [valor, setValor] = useState("");
  const [valor2, setValor2] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<{
    status: SemaforoStatus;
    texto: string;
    mensagem: string;
  } | null>(null);
  const [liberado, setLiberado] = useState(false);

  if (liberado) return <>{children}</>;

  async function medir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const principal = lerNumero(valor);
    const secundario = tipo === "pressao" ? lerNumero(valor2) : null;

    if (principal === null) {
      setErro(`Informe ${config.labelPrincipal.toLowerCase()}.`);
      return;
    }
    if (principal < config.min || principal > config.max) {
      setErro(
        `Valor fora do esperado — entre ${config.min} e ${config.max} ${config.unidade}.`
      );
      return;
    }
    if (tipo === "pressao" && secundario === null) {
      setErro("Informe também a diastólica.");
      return;
    }

    setErro(null);
    setSalvando(true);

    const { data, error } = await createClient()
      .from("indicadores")
      .insert({
        aluno_id: alunoId,
        tipo,
        valor_principal: principal,
        valor_secundario: secundario,
        unidade: config.unidade,
        momento: "pre_treino",
      })
      .select("*")
      .single();

    setSalvando(false);

    if (error || !data) {
      setErro("Não conseguimos registrar. Tente de novo.");
      return;
    }

    const registro = resumirIndicador(data as Indicador, altura);

    setResultado({
      status: registro.status,
      texto:
        tipo === "peso"
          ? registro.valorFormatado
          : `${registro.valorFormatado} ${config.unidade}`,
      mensagem:
        getMensagemAlerta(
          tipo,
          registro.status,
          registro.valorPrincipal,
          registro.valorSecundario ?? undefined
        ) || SEMAFORO_CONFIG[registro.status].mensagem,
    });

    // Verde e amarelo seguem direto; o vermelho exige uma confirmação extra.
    if (registro.status !== "vermelho") {
      setLiberado(true);
      router.refresh();
    }
  }

  if (resultado?.status === "vermelho") {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl border p-5",
          ESTILO.vermelho
        )}
      >
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
          <div>
            <h2 className="text-lg font-bold">
              {config.labelCurto} {resultado.texto}
            </h2>
            <p className="mt-1 text-sm text-neutral-800">
              {resultado.mensagem}
            </p>
            <p className="mt-2 text-sm font-semibold text-neutral-900">
              Seu professor já foi avisado. Procure ele antes de começar.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLiberado(true);
              router.refresh();
            }}
            className="h-12 rounded-xl bg-white font-semibold text-neutral-700"
          >
            Falei com o professor, quero ver o treino
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setResultado(null);
              setValor("");
              setValor2("");
            }}
            className="h-11 rounded-xl font-medium text-neutral-600"
          >
            Medir de novo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={medir}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5"
      noValidate
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-neutral-900">
            Antes de treinar
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Pela sua condição, precisamos saber{" "}
            {tipo === "pressao"
              ? "sua pressão"
              : `sua ${config.label.toLowerCase()}`}{" "}
            agora. Leva dez segundos e mantém o treino seguro.
          </p>
        </div>
      </div>

      <div className={cn("grid gap-3", tipo === "pressao" && "grid-cols-2")}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pre-valor" className="text-neutral-700">
            {config.labelPrincipal}{" "}
            <span className="font-normal text-neutral-400">
              ({config.unidade})
            </span>
          </Label>
          <Input
            id="pre-valor"
            inputMode={config.decimal ? "decimal" : "numeric"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={config.placeholder}
            disabled={salvando}
            autoFocus
            className="h-14 rounded-xl px-3.5 text-2xl font-semibold tabular-nums"
          />
        </div>

        {tipo === "pressao" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="pre-valor2" className="text-neutral-700">
              {config.labelSecundario}
            </Label>
            <Input
              id="pre-valor2"
              inputMode="numeric"
              value={valor2}
              onChange={(e) => setValor2(e.target.value)}
              placeholder={config.placeholderSecundario}
              disabled={salvando}
              className="h-14 rounded-xl px-3.5 text-2xl font-semibold tabular-nums"
            />
          </div>
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

      <Button
        type="submit"
        disabled={salvando}
        className="h-14 w-full rounded-xl text-base font-semibold"
      >
        {salvando ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Verificando...
          </>
        ) : (
          "Registrar e liberar treino"
        )}
      </Button>

      <button
        type="button"
        onClick={() => setLiberado(true)}
        className="text-sm text-neutral-500 underline-offset-4 hover:underline"
      >
        Não consigo medir agora
      </button>
    </form>
  );
}
