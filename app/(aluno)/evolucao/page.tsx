import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, ArrowRight, ArrowUp, Dumbbell, LineChart } from "lucide-react";

import { GraficoIndicador } from "@/components/aluno/GraficoIndicador";
import type { IndicadorTipo } from "@/lib/types";
import { getEvolucaoAluno, type SerieIndicador } from "@/lib/supabase/evolucao";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { alturaEmMetros, CONFIG_INDICADORES, ORDEM_INDICADORES } from "@/lib/utils/indicadores";

const DIAS = 90;

/** Para estes, subir é piorar — a seta muda de cor conforme o sentido. */
const MENOR_E_MELHOR: IndicadorTipo[] = ["glicemia", "pressao", "peso"];

export default async function EvolucaoPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { series, treinos, imcAtual, altura, avaliacoes } =
    await getEvolucaoAluno(perfil.id, DIAS);

  const metros = alturaEmMetros(altura);
  const faixaPeso: [number, number] | null = metros
    ? [
        Number((18.5 * metros * metros).toFixed(1)),
        Number((24.9 * metros * metros).toFixed(1)),
      ]
    : null;

  const comDados = ORDEM_INDICADORES.filter((tipo) => series[tipo]);

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Evolução</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          Seus últimos {DIAS} dias — indicadores e frequência de treino.
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Resumo ─────────────────────────────────────────────── */}
        <section className="-mt-14 grid grid-cols-2 gap-3 md:mt-0 md:grid-cols-4">
          <Numero
            valor={String(treinos.totalPeriodo)}
            label="treinos concluídos"
          />
          <Numero
            valor={
              treinos.esforcoMedio
                ? `${treinos.esforcoMedio.toFixed(1)}/10`
                : "—"
            }
            label="esforço médio"
          />
          <Numero
            valor={imcAtual ? imcAtual.toFixed(1).replace(".", ",") : "—"}
            label={imcAtual ? "IMC atual" : "IMC — sem altura"}
          />
          <Numero
            valor={String(comDados.length)}
            label="indicadores acompanhados"
          />
        </section>

        {/* ── Gráficos ───────────────────────────────────────────── */}
        {comDados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <LineChart className="size-5" aria-hidden />
            </span>
            <p className="text-base font-semibold text-neutral-900">
              Ainda não há o que comparar
            </p>
            <p className="max-w-xs text-sm text-neutral-500">
              Registre seus indicadores por alguns dias e a evolução aparece
              aqui em forma de gráfico.
            </p>
          </div>
        ) : (
          comDados.map((tipo) => (
            <CartaoGrafico
              key={tipo}
              tipo={tipo}
              serie={series[tipo]!}
              faixaPeso={faixaPeso}
            />
          ))
        )}

        {/* ── Avaliações físicas ─────────────────────────────────── */}
        {avaliacoes.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Avaliações físicas
            </h2>

            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full min-w-md text-sm">
                <caption className="sr-only">
                  Comparativo entre as avaliações lançadas pelo professor
                </caption>
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                    <th scope="col" className="px-3.5 py-2.5 font-medium">
                      Data
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Peso
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      IMC
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      % gordura
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 font-medium">
                      Cintura
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {avaliacoes.map((avaliacao, indice) => {
                    // Compara com a avaliação imediatamente anterior no tempo.
                    const anterior = avaliacoes[indice + 1];
                    const deltaPeso =
                      avaliacao.peso && anterior?.peso
                        ? avaliacao.peso - anterior.peso
                        : null;

                    return (
                      <tr key={avaliacao.id}>
                        <th
                          scope="row"
                          className="px-3.5 py-2.5 text-left font-medium whitespace-nowrap text-neutral-900"
                        >
                          {format(
                            new Date(`${avaliacao.data}T12:00:00Z`),
                            "dd/MM/yy"
                          )}
                        </th>
                        <td className="px-3 py-2.5 whitespace-nowrap text-neutral-700 tabular-nums">
                          {avaliacao.peso ? `${avaliacao.peso} kg` : "—"}
                          {deltaPeso !== null && deltaPeso !== 0 && (
                            <span
                              className={
                                deltaPeso < 0
                                  ? "text-saude-verde"
                                  : "text-neutral-400"
                              }
                            >
                              {" "}
                              {deltaPeso > 0 ? "+" : ""}
                              {deltaPeso.toFixed(1).replace(".", ",")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-neutral-700 tabular-nums">
                          {avaliacao.imc ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-neutral-700 tabular-nums">
                          {avaliacao.percentual_gordura
                            ? `${avaliacao.percentual_gordura}%`
                            : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-neutral-700 tabular-nums">
                          {avaliacao.circunferencia_cintura
                            ? `${avaliacao.circunferencia_cintura} cm`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {avaliacoes[0]?.observacoes && (
              <p className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
                <span className="font-semibold">
                  Observação da última avaliação:{" "}
                </span>
                {avaliacoes[0].observacoes}
              </p>
            )}
          </section>
        )}

        {/* ── Treinos por mês ────────────────────────────────────── */}
        {treinos.porMes.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Treinos por mês
            </h2>

            <ul className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white p-4">
              {treinos.porMes.map(({ mes, concluidos }) => {
                const maximo = Math.max(
                  ...treinos.porMes.map((m) => m.concluidos)
                );

                return (
                  <li key={mes} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm text-neutral-600 capitalize">
                      {format(new Date(`${mes}-01T12:00:00Z`), "MMMM", {
                        locale: ptBR,
                      })}
                    </span>
                    <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.round((concluidos / maximo) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="flex w-8 shrink-0 items-center justify-end gap-1 text-sm font-semibold text-neutral-900 tabular-nums">
                      <Dumbbell
                        className="size-3.5 text-neutral-300"
                        aria-hidden
                      />
                      {concluidos}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function CartaoGrafico({
  tipo,
  serie,
  faixaPeso,
}: {
  tipo: IndicadorTipo;
  serie: SerieIndicador;
  faixaPeso: [number, number] | null;
}) {
  const config = CONFIG_INDICADORES[tipo];
  const Icone = config.icone;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex size-9 items-center justify-center rounded-lg ${config.corIcone}`}
          >
            <Icone className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              {config.label}
            </h2>
            <p className="text-xs text-neutral-500">
              {serie.pontos.length}{" "}
              {serie.pontos.length === 1 ? "dia medido" : "dias medidos"} ·
              média {serie.media?.toFixed(1).replace(".", ",")} {config.unidade}
            </p>
          </div>
        </div>

        <Variacao tipo={tipo} valor={serie.variacao} unidade={config.unidade} />
      </div>

      <GraficoIndicador
        tipo={tipo}
        pontos={serie.pontos}
        faixaPeso={faixaPeso}
      />
    </section>
  );
}

/** Compara a média deste período com a do período anterior. */
function Variacao({
  tipo,
  valor,
  unidade,
}: {
  tipo: IndicadorTipo;
  valor: number | null;
  unidade: string;
}) {
  if (valor === null) {
    return (
      <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-400">
        Primeiro período
      </span>
    );
  }

  const estavel = Math.abs(valor) < 0.5;
  const subiu = valor > 0;
  const melhorou = MENOR_E_MELHOR.includes(tipo) ? !subiu : subiu;

  const Icone = estavel ? ArrowRight : subiu ? ArrowUp : ArrowDown;
  const cor = estavel
    ? "bg-neutral-100 text-neutral-500"
    : melhorou
      ? "bg-saude-verde-light text-saude-verde"
      : "bg-saude-amarelo-light text-saude-amarelo";

  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${cor}`}
      title="Comparado com o período anterior de mesma duração"
    >
      <Icone className="size-3.5" aria-hidden />
      {estavel
        ? "Estável"
        : `${subiu ? "+" : ""}${valor.toFixed(1).replace(".", ",")} ${unidade}`}
    </span>
  );
}

function Numero({ valor, label }: { valor: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-2xl leading-tight font-bold tracking-tight text-neutral-900 tabular-nums">
        {valor}
      </p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
