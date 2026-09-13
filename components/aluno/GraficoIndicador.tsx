"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CartesianGrid,
  Line,
  LineChart,
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
  Uma cor por indicador, validada para daltonismo (scripts/validate_palette).
  A pressão é o único gráfico com duas séries — e o par rosa/ciano é o de
  maior separação da lista, justamente por isso.
*/
const COR: Record<IndicadorTipo, string> = {
  glicemia: "#2563EB",
  pressao: "#E11D48",
  peso: "#16A34A",
  fc: "#D97706",
  saturacao: "#7C3AED",
};

const COR_DIASTOLICA = "#0891B2";

const CINZA_EIXO = "#A3A3A3";
const CINZA_GRADE = "#F0F0F0";
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

export function GraficoIndicador({
  tipo,
  pontos,
  faixaPeso,
}: GraficoIndicadorProps) {
  const config = CONFIG_INDICADORES[tipo];
  const ehPressao = tipo === "pressao";
  const faixa = tipo === "peso" ? faixaPeso : FAIXA_IDEAL[tipo];

  const valores = pontos.flatMap((p) =>
    [p.valor, p.valorSecundario].filter((v): v is number => v != null)
  );

  // Folga de 10% para o traço não encostar no topo nem na base.
  const minimo = Math.min(...valores, ...(faixa ?? []));
  const maximo = Math.max(...valores, ...(faixa ?? []));
  const folga = Math.max(2, (maximo - minimo) * 0.15);

  return (
    <div className="flex flex-col gap-3">
      {ehPressao && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            { cor: COR.pressao, label: "Sistólica (maior)" },
            { cor: COR_DIASTOLICA, label: "Diastólica (menor)" },
          ].map(({ cor, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 text-xs text-neutral-500"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: cor }}
                aria-hidden
              />
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={pontos}
            margin={{ top: 6, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={CINZA_GRADE}
              strokeDasharray="3 3"
            />

            {faixa && (
              <ReferenceArea
                y1={faixa[0]}
                y2={faixa[1]}
                fill={VERDE_FAIXA}
                fillOpacity={0.07}
                stroke="none"
              />
            )}

            {ehPressao && (
              <>
                <ReferenceLine
                  y={130}
                  stroke={COR.pressao}
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
                <ReferenceLine
                  y={85}
                  stroke={COR_DIASTOLICA}
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
              </>
            )}

            <XAxis
              dataKey="data"
              tickFormatter={rotularData}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: CINZA_EIXO }}
              minTickGap={24}
            />
            <YAxis
              domain={[
                Math.floor(minimo - folga),
                Math.ceil(maximo + folga),
              ]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: CINZA_EIXO }}
              width={44}
            />

            <Tooltip
              cursor={{ stroke: CINZA_EIXO, strokeDasharray: "3 3" }}
              content={<TooltipIndicador tipo={tipo} unidade={config.unidade} />}
            />

            <Line
              type="monotone"
              dataKey="valor"
              name={ehPressao ? "Sistólica" : config.labelCurto}
              stroke={COR[tipo]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: COR[tipo] }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF" }}
              isAnimationActive={false}
            />

            {ehPressao && (
              <Line
                type="monotone"
                dataKey="valorSecundario"
                name="Diastólica"
                stroke={COR_DIASTOLICA}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: COR_DIASTOLICA }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF" }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alternativa não-visual ao gráfico. */}
      <details className="group">
        <summary className="w-fit cursor-pointer text-xs font-medium text-neutral-500 underline-offset-4 hover:underline">
          Ver os números
        </summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {config.label} dia a dia, em {config.unidade}
            </caption>
            <thead className="sticky top-0 bg-neutral-50">
              <tr className="text-left text-xs text-neutral-500">
                <th scope="col" className="px-3 py-2 font-medium">
                  Dia
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {ehPressao ? "Sistólica" : config.labelCurto}
                </th>
                {ehPressao && (
                  <th scope="col" className="px-3 py-2 font-medium">
                    Diastólica
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pontos
                .slice()
                .reverse()
                .map((ponto) => (
                  <tr key={ponto.data}>
                    <th
                      scope="row"
                      className="px-3 py-1.5 text-left font-normal text-neutral-600"
                    >
                      {rotularData(ponto.data)}
                    </th>
                    <td className="px-3 py-1.5 text-neutral-900 tabular-nums">
                      {ponto.valor}
                    </td>
                    {ehPressao && (
                      <td className="px-3 py-1.5 text-neutral-900 tabular-nums">
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
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-neutral-500">
        {format(new Date(`${ponto.data}T12:00:00Z`), "EEE, dd 'de' MMM", {
          locale: ptBR,
        })}
      </p>
      <p className="text-sm font-semibold text-neutral-900 tabular-nums">
        {valor} {unidade}
      </p>
      {ponto.leituras > 1 && (
        <p className="text-xs text-neutral-400">
          média de {ponto.leituras} medições
        </p>
      )}
    </div>
  );
}
