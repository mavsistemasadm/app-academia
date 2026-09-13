"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PontoSerie } from "@/lib/supabase/evolucao";
import type { IndicadorTipo } from "@/lib/types";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";

/*
  Referência Apple Saúde: uma cor só para a série (o ciano da marca), área
  bem suave embaixo, grade pontilhada discreta e o último ponto em destaque.
  A pressão é o único gráfico com duas séries — a diastólica sai em grafite
  médio, sem área, para não disputar com a sistólica.

  SVG não resolve `var()` em atributo de apresentação, por isso os valores
  dos tokens vão escritos aqui.
*/
const CIANO = "#0A8FA3";
const CINZA_SERIE = "#5C6466";
const CINZA_EIXO = "#93A0A3"; // neutral-400
const CINZA_GRADE = "#DFE6E7"; // neutral-200
const VERDE_FAIXA = "#16A34A";

/** Faixa ideal desenhada ao fundo. A pressão usa linhas-limite. */
const FAIXA_IDEAL: Partial<Record<IndicadorTipo, [number, number]>> = {
  glicemia: [70, 125],
  fc: [50, 90],
  saturacao: [95, 100],
};

interface GraficoIndicadorProps {
  tipo: IndicadorTipo;
  pontos: PontoSerie[];
  /** Faixa de peso saudável (IMC 18,5–24,9), quando a altura é conhecida. */
  faixaPeso?: [number, number] | null;
}

function rotularData(iso: string) {
  return format(new Date(`${iso}T12:00:00Z`), "dd/MM", { locale: ptBR });
}

interface PropsPonto {
  cx?: number;
  cy?: number;
  index?: number;
}

/** Só o último ponto aparece — é "onde você está agora". */
function pontoFinal(cor: string, ultimo: number) {
  function PontoFinal({ cx, cy, index }: PropsPonto) {
    if (index !== ultimo || cx == null || cy == null) {
      return <g key={`p-${index}`} />;
    }
    return (
      <g key={`p-${index}`}>
        <circle cx={cx} cy={cy} r={9} fill={cor} fillOpacity={0.15} />
        <circle cx={cx} cy={cy} r={4.5} fill={cor} stroke="#FFFFFF" strokeWidth={2} />
      </g>
    );
  }
  return PontoFinal;
}

export function GraficoIndicador({
  tipo,
  pontos,
  faixaPeso,
}: GraficoIndicadorProps) {
  const config = CONFIG_INDICADORES[tipo];
  const ehPressao = tipo === "pressao";
  const faixa = tipo === "peso" ? faixaPeso : FAIXA_IDEAL[tipo];
  const ultimo = pontos.length - 1;
  const idGradiente = `gradiente-${tipo}`;

  const valores = pontos.flatMap((p) =>
    [p.valor, p.valorSecundario].filter((v): v is number => v != null)
  );

  // Folga para o traço não encostar no topo nem na base.
  const minimo = Math.min(...valores, ...(faixa ?? []));
  const maximo = Math.max(...valores, ...(faixa ?? []));
  const folga = Math.max(2, (maximo - minimo) * 0.15);
  const piso = Math.floor(minimo - folga);

  return (
    <div className="flex flex-col gap-3">
      {ehPressao && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            { cor: CIANO, label: "Sistólica (maior)" },
            { cor: CINZA_SERIE, label: "Diastólica (menor)" },
          ].map(({ cor, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 text-[13px] text-neutral-500"
            >
              <span
                className="h-[3px] w-3.5 rounded-full"
                style={{ backgroundColor: cor }}
                aria-hidden
              />
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="h-52 w-full md:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={pontos}
            margin={{ top: 12, right: 12, bottom: 0, left: -14 }}
          >
            <defs>
              <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CIANO} stopOpacity={0.16} />
                <stop offset="100%" stopColor={CIANO} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke={CINZA_GRADE}
              strokeDasharray="2 4"
            />

            {faixa && (
              <ReferenceArea
                y1={faixa[0]}
                y2={faixa[1]}
                fill={VERDE_FAIXA}
                fillOpacity={0.06}
                stroke="none"
              />
            )}

            {ehPressao && (
              <>
                <ReferenceLine
                  y={130}
                  stroke={VERDE_FAIXA}
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                />
                <ReferenceLine
                  y={85}
                  stroke={VERDE_FAIXA}
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                />
              </>
            )}

            <XAxis
              dataKey="data"
              tickFormatter={rotularData}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: CINZA_EIXO }}
              tickMargin={8}
              minTickGap={28}
            />
            <YAxis
              domain={[piso, Math.ceil(maximo + folga)]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: CINZA_EIXO }}
              width={46}
            />

            <Tooltip
              cursor={{ stroke: CINZA_GRADE, strokeWidth: 1 }}
              content={<TooltipIndicador tipo={tipo} unidade={config.unidade} />}
            />

            <Area
              type="monotone"
              dataKey="valor"
              name={ehPressao ? "Sistólica" : config.labelCurto}
              stroke={CIANO}
              strokeWidth={2.5}
              fill={`url(#${idGradiente})`}
              baseValue={piso}
              dot={pontoFinal(CIANO, ultimo)}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF", fill: CIANO }}
              isAnimationActive={false}
            />

            {ehPressao && (
              <Line
                type="monotone"
                dataKey="valorSecundario"
                name="Diastólica"
                stroke={CINZA_SERIE}
                strokeWidth={2}
                dot={pontoFinal(CINZA_SERIE, ultimo)}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF", fill: CINZA_SERIE }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Alternativa não-visual ao gráfico. */}
      <details className="group">
        <summary className="w-fit cursor-pointer text-[13px] font-medium text-neutral-500 underline-offset-4 hover:text-neutral-950 hover:underline">
          Ver os números
        </summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl ring-1 ring-neutral-200/90">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {config.label} dia a dia, em {config.unidade}
            </caption>
            <thead className="sticky top-0 bg-neutral-50">
              <tr className="text-left">
                <th scope="col" className="rotulo px-3 py-2 font-medium text-neutral-400">
                  Dia
                </th>
                <th scope="col" className="rotulo px-3 py-2 font-medium text-neutral-400">
                  {ehPressao ? "Sistólica" : config.labelCurto}
                </th>
                {ehPressao && (
                  <th scope="col" className="rotulo px-3 py-2 font-medium text-neutral-400">
                    Diastólica
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/80">
              {pontos
                .slice()
                .reverse()
                .map((ponto) => (
                  <tr key={ponto.data}>
                    <th
                      scope="row"
                      className="px-3 py-1.5 text-left font-normal text-neutral-500 tabular-nums"
                    >
                      {rotularData(ponto.data)}
                    </th>
                    <td className="numero px-3 py-1.5 font-medium text-neutral-950">
                      {ponto.valor}
                    </td>
                    {ehPressao && (
                      <td className="numero px-3 py-1.5 font-medium text-neutral-950">
                        {ponto.valorSecundario ?? "—"}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

interface TooltipPayload {
  payload: PontoSerie;
}

function TooltipIndicador({
  active,
  payload,
  tipo,
  unidade,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  tipo: IndicadorTipo;
  unidade: string;
}) {
  const ponto = payload?.[0]?.payload;
  if (!active || !ponto) return null;

  const valor =
    tipo === "pressao" && ponto.valorSecundario != null
      ? `${ponto.valor}/${ponto.valorSecundario}`
      : String(ponto.valor);

  return (
    <div className="rounded-xl bg-white px-3.5 py-2.5 shadow-[0_8px_24px_-12px_rgba(12,18,20,.3)] ring-1 ring-neutral-200/90">
      <p className="rotulo text-neutral-400">
        {format(new Date(`${ponto.data}T12:00:00Z`), "EEE, dd MMM", {
          locale: ptBR,
        })}
      </p>
      <p className="numero mt-1 text-lg leading-none font-semibold text-neutral-950">
        {valor}
        <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
          {unidade}
        </span>
      </p>
      {ponto.leituras > 1 && (
        <p className="mt-1 text-xs text-neutral-500">
          média de {ponto.leituras} medições
        </p>
      )}
    </div>
  );
}
