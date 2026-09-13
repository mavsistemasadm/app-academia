"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
import { FaixaSemaforo } from "@/components/shared/FaixaSemaforo";
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

interface PortaoPreTreinoProps {
  alunoId: string;
  /** O indicador que a condição clínica do aluno exige antes de treinar. */
  tipo: IndicadorTipo;
  altura: number | null;
  /** Renderizado quando o aluno é liberado para treinar. */
  children: React.ReactNode;
}

interface Resultado {
  status: SemaforoStatus;
  texto: string;
  mensagem: string;
  /** Número que a faixa do semáforo posiciona — IMC no caso do peso. */
  faixa: { valor: number; valorSecundario: number | null } | null;
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
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [liberado, setLiberado] = useState(false);

  if (liberado) {
    return (
      <div className="flex flex-col gap-4">
        {resultado && resultado.status !== "vermelho" && (
          <LeituraPreTreino
            resultado={resultado}
            tipo={tipo}
            titulo={config.labelCurto}
            veredito="Treino liberado"
          />
        )}
        {children}
      </div>
    );
  }

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
      faixa:
        tipo === "peso"
          ? registro.imc
            ? { valor: registro.imc, valorSecundario: null }
            : null
          : {
              valor: registro.valorPrincipal,
              valorSecundario: registro.valorSecundario ?? null,
            },
    });

    // Verde e amarelo seguem direto; o vermelho exige uma confirmação extra.
    if (registro.status !== "vermelho") {
      setLiberado(true);
      router.refresh();
    }
  }

  if (resultado?.status === "vermelho") {
    return (
      <div className="flex flex-col gap-5 rounded-[26px] bg-saude-vermelho-light p-5 md:p-7">
        <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 md:p-5">
          <CabecaLeitura
            resultado={resultado}
            titulo={config.labelCurto}
          />
          {resultado.faixa && (
            <FaixaSemaforo
              tipo={tipo}
              valor={resultado.faixa.valor}
              valorSecundario={resultado.faixa.valorSecundario}
            />
          )}
        </div>

        <div role="alert">
          <p className="rotulo flex items-center gap-2 text-[#b91c1c]">
            <span className="size-2 rounded-full bg-saude-vermelho" />
            Não treine ainda
          </p>
          <h2 className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.025em] text-neutral-950">
            Fale com seu professor antes de começar
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
            {resultado.mensagem}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed font-semibold text-neutral-950">
            Ele já recebeu um aviso sobre essa medição.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={() => {
              setLiberado(true);
              router.refresh();
            }}
            className="h-12 w-full rounded-full bg-grafite text-[15px] font-semibold text-white hover:bg-neutral-800"
          >
            Já falei com o professor, ver o treino
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setResultado(null);
              setValor("");
              setValor2("");
            }}
            className="h-12 w-full rounded-full text-[15px] font-semibold text-neutral-700 hover:bg-white/60"
          >
            Medir de novo
          </Button>
        </div>
      </div>
    );
  }

  const nomeMedicao =
    tipo === "pressao" ? "sua pressão" : `sua ${config.label.toLowerCase()}`;

  return (
    <form
      onSubmit={medir}
      className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-7"
      noValidate
    >
      <div>
        <p className="rotulo text-neutral-400">Prontidão para treinar</p>
        <h2 className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.025em] text-neutral-950">
          Antes de começar, meça {nomeMedicao}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
          Pela sua condição, essa medição diz se o corpo está pronto para o
          treino de hoje. Leva dez segundos.
        </p>
      </div>

      <div
        className={cn(
          "grid gap-3",
          tipo === "pressao" && "grid-cols-2"
        )}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="pre-valor" className="text-[13px] text-neutral-600">
            {config.labelPrincipal}{" "}
            <span className="font-mono text-[11px] font-normal text-neutral-400">
              {config.unidade}
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
            className="numero h-16 px-4 text-[28px] font-semibold md:text-[28px]"
          />
        </div>

        {tipo === "pressao" && (
          <div className="flex min-w-0 flex-col gap-2">
            <Label
              htmlFor="pre-valor2"
              className="text-[13px] text-neutral-600"
            >
              {config.labelSecundario}
            </Label>
            <Input
              id="pre-valor2"
              inputMode="numeric"
              value={valor2}
              onChange={(e) => setValor2(e.target.value)}
              placeholder={config.placeholderSecundario}
              disabled={salvando}
              className="numero h-16 px-4 text-[28px] font-semibold md:text-[28px]"
            />
          </div>
        )}
      </div>

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <Button
          type="submit"
          disabled={salvando}
          className="h-12 w-full rounded-full text-[15px] font-semibold"
        >
          {salvando ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Verificando...
            </>
          ) : (
            "Registrar e ver se posso treinar"
          )}
        </Button>

        <button
          type="button"
          onClick={() => setLiberado(true)}
          className="h-12 text-sm font-medium text-neutral-500 underline-offset-4 transition-colors hover:text-neutral-700 hover:underline"
        >
          Não consigo medir agora
        </button>
      </div>
    </form>
  );
}

/** Nome do indicador, chip do semáforo e o valor em destaque. */
function CabecaLeitura({
  resultado,
  titulo,
}: {
  resultado: Resultado;
  titulo: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-neutral-500">
          {titulo} antes do treino
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            CHIP_SEMAFORO[resultado.status]
          )}
        >
          {SEMAFORO_CONFIG[resultado.status].label}
        </span>
      </div>
      <p className="numero text-[28px] leading-none font-semibold text-neutral-950 md:text-[32px]">
        {resultado.texto}
      </p>
    </div>
  );
}

/** Resumo que fica em cima do treino depois de liberado (verde ou amarelo). */
function LeituraPreTreino({
  resultado,
  tipo,
  titulo,
  veredito,
}: {
  resultado: Resultado;
  tipo: IndicadorTipo;
  titulo: string;
  veredito: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-neutral-200/90 md:p-5">
      <CabecaLeitura resultado={resultado} titulo={titulo} />
      {resultado.faixa && (
        <FaixaSemaforo
          tipo={tipo}
          valor={resultado.faixa.valor}
          valorSecundario={resultado.faixa.valorSecundario}
        />
      )}
      <div className="border-t border-neutral-200/80 pt-3">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-neutral-950">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              resultado.status === "verde"
                ? "bg-saude-verde"
                : "bg-saude-amarelo"
            )}
          />
          {veredito}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">
          {resultado.status === "verde"
            ? "Tudo dentro da faixa. Bom treino!"
            : `${resultado.mensagem}. Pode treinar, mas vá com calma e avise o professor se sentir algo.`}
        </p>
      </div>
    </div>
  );
}
