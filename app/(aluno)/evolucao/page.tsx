import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight } from "lucide-react";

import { GraficoIndicador } from "@/components/aluno/GraficoIndicador";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import type { AvaliacaoFisica, IndicadorTipo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getEvolucaoAluno, type SerieIndicador } from "@/lib/supabase/evolucao";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { alturaEmMetros, CONFIG_INDICADORES, ORDEM_INDICADORES } from "@/lib/utils/indicadores";

const DIAS = 90;

/** Para estes, subir é piorar — a cor da frase muda conforme o sentido. */
const MENOR_E_MELHOR: IndicadorTipo[] = ["glicemia", "pressao", "peso"];

const TITULO_SECAO =
  "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";

const CARD = "rounded-2xl bg-card ring-1 ring-neutral-200/90";

function numeroBR(valor: number, casas = 1) {
  return String(Number(valor.toFixed(casas))).replace(".", ",");
}

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

  const resumo = [
    { valor: String(treinos.totalPeriodo), unidade: "", label: "Treinos concluídos" },
    {
      valor: treinos.esforcoMedio ? numeroBR(treinos.esforcoMedio) : "-",
      unidade: treinos.esforcoMedio ? "/10" : "",
      label: "Esforço médio",
    },
    {
      valor: imcAtual ? numeroBR(imcAtual) : "-",
      unidade: "",
      label: imcAtual ? "IMC atual" : "IMC: falta altura",
    },
    { valor: String(comDados.length), unidade: "", label: "Indicadores acompanhados" },
  ];

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Saúde"
        titulo="Evolução"
        descricao={`Seus últimos ${DIAS} dias: indicadores e frequência de treino.`}
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Resumo ─────────────────────────────────────────────── */}
        <section
          aria-label="Resumo do período"
          className={cn(
            CARD,
            "grid grid-cols-2 overflow-hidden md:grid-cols-4",
            "divide-neutral-200/80 max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r md:divide-x"
          )}
        >
          {resumo.map(({ valor, unidade, label }) => (
            <div key={label} className="flex flex-col gap-2 border-neutral-200/80 p-4 md:p-5">
              <p className="numero text-[28px] leading-none font-semibold text-neutral-950 md:text-[32px]">
                {valor}
                {unidade && (
                  <span className="ml-0.5 font-sans text-xs font-medium tracking-normal text-neutral-400">
                    {unidade}
                  </span>
                )}
              </p>
              <p className="text-[13px] leading-snug text-neutral-500">{label}</p>
            </div>
          ))}
        </section>

        {/* ── Gráficos ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className={TITULO_SECAO}>Indicadores</h2>

          {comDados.length === 0 ? (
            <div className={cn(CARD, "flex flex-col gap-1.5 px-5 py-6")}>
              <p className="text-[15px] font-semibold text-neutral-950">
                Ainda não há o que comparar
              </p>
              <p className="max-w-sm text-[15px] leading-relaxed text-neutral-500">
                Registre seus indicadores por alguns dias e a evolução aparece
                aqui em forma de gráfico.
              </p>
              <Link
                href="/indicadores#registrar"
                className="mt-1 flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline underline-offset-4"
              >
                Registrar medição
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
              {comDados.map((tipo) => (
                <CartaoGrafico
                  key={tipo}
                  tipo={tipo}
                  serie={series[tipo]!}
                  faixaPeso={faixaPeso}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Avaliações físicas ─────────────────────────────────── */}
        {avaliacoes.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <h2 className={TITULO_SECAO}>Avaliações físicas</h2>
            <ComparativoAvaliacoes avaliacoes={avaliacoes} />
          </section>
        )}

        {/* ── Treinos por mês ────────────────────────────────────── */}
        {treinos.porMes.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <h2 className={TITULO_SECAO}>Treinos por mês</h2>
            <TreinosPorMes porMes={treinos.porMes} />
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
  const ultimoPonto = serie.pontos[serie.pontos.length - 1];
  const valorAtual =
    tipo === "pressao" && ultimoPonto?.valorSecundario != null
      ? `${Math.round(ultimoPonto.valor)}/${Math.round(ultimoPonto.valorSecundario)}`
      : ultimoPonto
        ? numeroBR(ultimoPonto.valor)
        : "-";

  return (
    <article className={cn(CARD, "flex min-w-0 flex-col gap-4 p-5")}>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
            {config.label}
          </h3>
          <span className="rotulo shrink-0 text-neutral-400">
            {serie.pontos.length} {serie.pontos.length === 1 ? "dia" : "dias"}
          </span>
        </div>

        <p className="numero mt-1 text-[28px] leading-none font-semibold text-neutral-950 md:text-[32px]">
          {valorAtual}
          <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
            {config.unidade}
          </span>
        </p>

        <Variacao tipo={tipo} serie={serie} unidade={config.unidade} />
      </div>

      <GraficoIndicador
        tipo={tipo}
        pontos={serie.pontos}
        faixaPeso={faixaPeso}
      />
    </article>
  );
}

/** Compara a média deste período com a do período anterior, em uma frase. */
function Variacao({
  tipo,
  serie,
  unidade,
}: {
  tipo: IndicadorTipo;
  serie: SerieIndicador;
  unidade: string;
}) {
  const { variacao: valor, media } = serie;
  const textoMedia =
    media !== null ? `Média de ${numeroBR(media)} ${unidade}` : null;

  if (valor === null) {
    return (
      <p className="text-sm leading-relaxed text-neutral-500">
        {textoMedia ? `${textoMedia}. ` : ""}Primeiro período. A comparação
        aparece nos próximos {DIAS} dias.
      </p>
    );
  }

  const estavel = Math.abs(valor) < 0.5;
  const subiu = valor > 0;
  const melhorou = MENOR_E_MELHOR.includes(tipo) ? !subiu : subiu;

  // A série só guarda a diferença; a média anterior sai dela.
  const mediaAnterior = media !== null ? media - valor : null;
  const percentual =
    mediaAnterior && mediaAnterior > 0
      ? Math.round((Math.abs(valor) / mediaAnterior) * 100)
      : null;

  const destaque =
    percentual !== null && percentual >= 1
      ? `${percentual}%`
      : `${numeroBR(Math.abs(valor))} ${unidade}`;

  return (
    <p
      className="text-sm leading-relaxed text-neutral-500"
      title="Comparado com o período anterior de mesma duração"
    >
      {estavel ? (
        <>Estável em relação aos {DIAS} dias anteriores</>
      ) : (
        <>
          <span
            className={cn(
              "numero font-semibold",
              melhorou ? "text-saude-verde" : "text-saude-amarelo"
            )}
          >
            {destaque}
          </span>{" "}
          {subiu ? "maior" : "menor"} que nos {DIAS} dias anteriores
        </>
      )}
      {textoMedia && <span className="text-neutral-400"> · {textoMedia}</span>}
    </p>
  );
}

function Delta({ atual, anterior, unidade }: { atual?: number; anterior?: number; unidade: string }) {
  if (atual == null || anterior == null) return null;
  const diferenca = atual - anterior;
  if (Math.abs(diferenca) < 0.05) {
    return <span className="text-[13px] text-neutral-400">igual à anterior</span>;
  }

  // Peso, IMC, gordura e cintura: baixar é o sentido bom.
  return (
    <span
      className={cn(
        "text-[13px] font-medium",
        diferenca < 0 ? "text-saude-verde" : "text-neutral-400"
      )}
    >
      {diferenca > 0 ? "+" : "−"}
      {numeroBR(Math.abs(diferenca))}
      {unidade} desde a anterior
    </span>
  );
}

function ComparativoAvaliacoes({ avaliacoes }: { avaliacoes: AvaliacaoFisica[] }) {
  const [atual, anterior] = avaliacoes;
  const dataCurta = (iso: string) =>
    format(new Date(`${iso}T12:00:00Z`), "dd MMM yyyy", { locale: ptBR });

  const metricas: {
    label: string;
    valor?: number;
    anterior?: number;
    unidade: string;
    unidadeDelta: string;
  }[] = [
    { label: "Peso", valor: atual.peso, anterior: anterior?.peso, unidade: "kg", unidadeDelta: " kg" },
    { label: "IMC", valor: atual.imc, anterior: anterior?.imc, unidade: "", unidadeDelta: "" },
    {
      label: "Gordura",
      valor: atual.percentual_gordura,
      anterior: anterior?.percentual_gordura,
      unidade: "%",
      unidadeDelta: " pp",
    },
    {
      label: "Cintura",
      valor: atual.circunferencia_cintura,
      anterior: anterior?.circunferencia_cintura,
      unidade: "cm",
      unidadeDelta: " cm",
    },
  ];

  return (
    <div className={cn(CARD, "flex flex-col divide-y divide-neutral-200/80 overflow-hidden")}>
      <div className="flex flex-col gap-4 p-5">
        <p className="rotulo text-neutral-400">Última avaliação · {dataCurta(atual.data)}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
          {metricas.map(({ label, valor, anterior: valorAnterior, unidade, unidadeDelta }) => (
            <div key={label} className="flex min-w-0 flex-col gap-1">
              <dt className="text-[13px] font-medium text-neutral-500">{label}</dt>
              <dd className="numero text-[28px] leading-none font-semibold text-neutral-950">
                {valor != null ? numeroBR(valor) : "-"}
                {valor != null && unidade && (
                  <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
                    {unidade}
                  </span>
                )}
              </dd>
              <dd>
                <Delta atual={valor} anterior={valorAnterior} unidade={unidadeDelta} />
              </dd>
            </div>
          ))}
        </dl>

        {atual.observacoes && (
          <p className="text-[15px] leading-relaxed text-neutral-600">
            <span className="font-semibold text-neutral-950">Do professor: </span>
            {atual.observacoes}
          </p>
        )}
      </div>

      {avaliacoes.length > 1 && (
        <div>
          <p className="rotulo bg-neutral-50 px-5 py-2 text-neutral-400">Anteriores</p>
          <ul className="divide-y divide-neutral-200/80">
            {avaliacoes.slice(1).map((avaliacao) => {
              const partes = [
                avaliacao.peso != null ? `${numeroBR(avaliacao.peso)} kg` : null,
                avaliacao.imc != null ? `IMC ${numeroBR(avaliacao.imc)}` : null,
                avaliacao.percentual_gordura != null
                  ? `${numeroBR(avaliacao.percentual_gordura)}% gordura`
                  : null,
                avaliacao.circunferencia_cintura != null
                  ? `${numeroBR(avaliacao.circunferencia_cintura)} cm cintura`
                  : null,
              ].filter(Boolean);

              return (
                <li
                  key={avaliacao.id}
                  className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="rotulo shrink-0 text-neutral-400 sm:w-28">
                    {dataCurta(avaliacao.data)}
                  </span>
                  <span className="text-sm text-neutral-700 tabular-nums">
                    {partes.length > 0 ? partes.join(" · ") : "Sem medidas lançadas"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function TreinosPorMes({ porMes }: { porMes: { mes: string; concluidos: number }[] }) {
  const maximo = Math.max(1, ...porMes.map((m) => m.concluidos));
  const ultimo = porMes.length - 1;

  return (
    <div className={cn(CARD, "p-5")}>
      <ul className="flex h-44 items-end gap-3 md:gap-5">
        {porMes.map(({ mes, concluidos }, indice) => (
          <li key={mes} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="numero text-lg leading-none font-semibold text-neutral-950">
              {concluidos}
            </span>
            <span aria-hidden className="flex min-h-0 w-full flex-1 items-end justify-center">
              <span
                className={cn(
                  "w-full max-w-14 rounded-lg",
                  indice === ultimo ? "bg-ciano" : "bg-ciano/35"
                )}
                style={{ height: `${Math.max(4, Math.round((concluidos / maximo) * 100))}%` }}
              />
            </span>
            <span className="rotulo truncate text-neutral-400">
              {format(new Date(`${mes}-01T12:00:00Z`), "MMM", { locale: ptBR })}
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only">
        {porMes
          .map(
            ({ mes, concluidos }) =>
              `${format(new Date(`${mes}-01T12:00:00Z`), "MMMM", { locale: ptBR })}: ${concluidos} treinos`
          )
          .join("; ")}
      </p>
    </div>
  );
}
