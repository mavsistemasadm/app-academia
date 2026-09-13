import Image from "next/image";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { BotaoImprimir } from "@/components/aluno/BotaoImprimir";
import { CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { cn } from "@/lib/utils";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getRelatorioMensal } from "@/lib/supabase/relatorio";
import { rotularCondicoes } from "@/lib/utils/avatares";
import { hojeISO, naAcademia, somarDiasISO } from "@/lib/utils/datas";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";
import { HUMOR_CONFIG } from "@/lib/utils/saudacao";

function nomeDoMes(mes: string) {
  return format(new Date(`${mes}-01T12:00:00Z`), "MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

/* Classes repetidas da folha: título de seção e células das tabelas. */
const TITULO_SECAO =
  "text-base font-semibold tracking-[-0.015em] text-neutral-950";
const CABECA = "py-2 pr-4 font-medium whitespace-nowrap last:pr-0";
const CELULA = "py-2.5 pr-4 last:pr-0";

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { mes: mesParam } = await searchParams;
  const mesAtual = hojeISO().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual;

  const relatorio = await getRelatorioMensal(perfil, mes);

  // Os três meses mais recentes, para o seletor.
  const opcoesMes = Array.from({ length: 3 }, (_, i) =>
    somarDiasISO(`${mesAtual}-01`, -i * 30).slice(0, 7)
  ).filter((valor, indice, todos) => todos.indexOf(valor) === indice);

  const adesao =
    relatorio.adesaoRemedio.previstas > 0
      ? Math.round(
          (relatorio.adesaoRemedio.confirmadas /
            relatorio.adesaoRemedio.previstas) *
            100
        )
      : null;

  const frequencia =
    relatorio.treinosPrevistos > 0
      ? Math.round(
          (relatorio.treinosFeitos / relatorio.treinosPrevistos) * 100
        )
      : null;

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10 print:gap-0 print:p-0">
      {/* ── Controles (somem na impressão) ─────────────────────────── */}
      <div className="flex flex-col gap-5 print:hidden">
        <CabecalhoPagina
          rotulo="Documento"
          titulo="Relatório para o médico"
          descricao="Um resumo do mês para levar na consulta. Escolha o mês e salve em PDF."
        />

        <div className="flex flex-col gap-3 px-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:px-0">
          <nav aria-label="Mês do relatório" className="flex flex-wrap gap-2">
            {opcoesMes.map((opcao) => (
              <a
                key={opcao}
                href={`/relatorio?mes=${opcao}`}
                aria-current={opcao === mes ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-full px-4 text-sm font-medium transition-all duration-200 first-letter:uppercase active:scale-[.98]",
                  opcao === mes
                    ? "bg-grafite text-white"
                    : "bg-card text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50"
                )}
              >
                {nomeDoMes(opcao)}
              </a>
            ))}
          </nav>

          <BotaoImprimir />
        </div>
      </div>

      {/* ── A folha ────────────────────────────────────────────────── */}
      <article className="mx-5 flex flex-col gap-8 rounded-2xl bg-white p-5 text-neutral-900 ring-1 ring-neutral-200/90 [print-color-adjust:exact] sm:p-8 md:mx-0 md:p-10 print:mx-0 print:gap-6 print:rounded-none print:p-0 print:ring-0">
        <header className="flex flex-col gap-1.5 border-b border-neutral-200 pb-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Image
              src="/marca/logo.png"
              alt="Atitude Vital — centro de treinamento"
              width={1000}
              height={336}
              priority
              sizes="144px"
              className="h-auto w-32 sm:w-36"
            />
            <p className="rotulo text-right text-neutral-400">
              Central de Saúde Conectada
            </p>
          </div>
          <p className="rotulo text-neutral-400">Relatório de acompanhamento</p>
          <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.025em] text-neutral-950 first-letter:uppercase sm:text-[26px]">
            {nomeDoMes(mes)}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-700">
            <span className="font-semibold text-neutral-950">{perfil.nome}</span> ·{" "}
            {rotularCondicoes(perfil.avatar_condicao)}
            {perfil.data_nascimento &&
              ` · nascido em ${format(new Date(`${perfil.data_nascimento}T12:00:00Z`), "dd/MM/yyyy")}`}
          </p>
          <p className="text-[13px] text-neutral-500">
            Período de {format(new Date(`${relatorio.inicio}T12:00:00Z`), "dd/MM/yyyy")} a{" "}
            {format(new Date(`${relatorio.fim}T12:00:00Z`), "dd/MM/yyyy")} ·
            emitido em {format(new Date(`${hojeISO()}T12:00:00Z`), "dd/MM/yyyy")}
          </p>
        </header>

        {/* ── Indicadores ──────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h3 className={TITULO_SECAO}>Indicadores clínicos</h3>

          {relatorio.indicadores.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nenhuma medição registrada neste mês.
            </p>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
              <table className="w-full min-w-[520px] text-sm print:min-w-0">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th scope="col" className={CABECA}>Indicador</th>
                    <th scope="col" className={CABECA}>Medições</th>
                    <th scope="col" className={CABECA}>Média</th>
                    <th scope="col" className={CABECA}>Mínimo</th>
                    <th scope="col" className={CABECA}>Máximo</th>
                    <th scope="col" className={CABECA}>Fora da faixa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {relatorio.indicadores.map((resumo) => {
                    const config = CONFIG_INDICADORES[resumo.tipo];
                    const forA = resumo.amarelos + resumo.vermelhos;

                    return (
                      <tr key={resumo.tipo}>
                        <th scope="row" className={cn(CELULA, "text-left font-medium")}>
                          {config.label}{" "}
                          <span className="font-normal whitespace-nowrap text-neutral-400">
                            ({config.unidade})
                          </span>
                        </th>
                        <td className={cn(CELULA, "numero")}>{resumo.medicoes}</td>
                        <td className={cn(CELULA, "numero font-semibold whitespace-nowrap text-neutral-950")}>
                          {resumo.media.toFixed(1).replace(".", ",")}
                          {resumo.mediaSecundaria !== null &&
                            ` / ${resumo.mediaSecundaria.toFixed(1).replace(".", ",")}`}
                        </td>
                        <td className={cn(CELULA, "numero")}>{resumo.minimo}</td>
                        <td className={cn(CELULA, "numero")}>{resumo.maximo}</td>
                        <td className={CELULA}>
                          <span className="numero">
                            {forA} de {resumo.medicoes}
                          </span>
                          {resumo.vermelhos > 0 && (
                            <span className="text-saude-vermelho">
                              {" "}
                              ({resumo.vermelhos} crítico
                              {resumo.vermelhos > 1 ? "s" : ""})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Frequência e esforço ─────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h3 className={TITULO_SECAO}>Atividade física</h3>

          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-neutral-200 ring-1 ring-neutral-200 sm:grid-cols-4">
            <Dado
              valor={`${relatorio.treinosFeitos}`}
              rotulo={
                frequencia !== null
                  ? `treinos feitos (${frequencia}% do previsto)`
                  : "treinos feitos"
              }
            />
            <Dado valor={`${relatorio.presencas}`} rotulo="dias na academia" />
            <Dado
              valor={
                relatorio.esforcoMedio
                  ? `${relatorio.esforcoMedio.toFixed(1)}/10`
                  : "—"
              }
              rotulo="esforço percebido médio"
            />
            <Dado
              valor={adesao !== null ? `${adesao}%` : "—"}
              rotulo="adesão a medicamentos"
            />
          </ul>
        </section>

        {/* ── Humor ────────────────────────────────────────────── */}
        {relatorio.diasComHumor > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className={TITULO_SECAO}>Estado geral relatado</h3>
            <p className="text-sm leading-relaxed text-neutral-700">
              <span className="numero font-semibold text-neutral-950">
                {relatorio.diasComHumor}
              </span>{" "}
              {relatorio.diasComHumor === 1
                ? "dia registrado"
                : "dias registrados"}
              :{" "}
              {relatorio.humor
                .map(
                  ({ tipo, dias }) =>
                    `${HUMOR_CONFIG[tipo].label.toLowerCase()} em ${dias} ${dias === 1 ? "dia" : "dias"}`
                )
                .join(", ")}
              .
            </p>
          </section>
        )}

        {/* ── Avaliação física ─────────────────────────────────── */}
        {relatorio.avaliacoes.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className={TITULO_SECAO}>Avaliações físicas recentes</h3>

            <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
              <table className="w-full min-w-[420px] text-sm print:min-w-0">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th scope="col" className={CABECA}>Data</th>
                    <th scope="col" className={CABECA}>Peso</th>
                    <th scope="col" className={CABECA}>IMC</th>
                    <th scope="col" className={CABECA}>% gordura</th>
                    <th scope="col" className={CABECA}>Cintura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {relatorio.avaliacoes.map((avaliacao) => (
                    <tr key={avaliacao.id}>
                      <th scope="row" className={cn(CELULA, "numero text-left font-medium whitespace-nowrap")}>
                        {format(
                          new Date(`${avaliacao.data}T12:00:00Z`),
                          "dd/MM/yyyy"
                        )}
                      </th>
                      <td className={cn(CELULA, "numero whitespace-nowrap")}>
                        {avaliacao.peso ? `${avaliacao.peso} kg` : "—"}
                      </td>
                      <td className={cn(CELULA, "numero")}>{avaliacao.imc ?? "—"}</td>
                      <td className={cn(CELULA, "numero")}>
                        {avaliacao.percentual_gordura
                          ? `${avaliacao.percentual_gordura}%`
                          : "—"}
                      </td>
                      <td className={cn(CELULA, "numero whitespace-nowrap")}>
                        {avaliacao.circunferencia_cintura
                          ? `${avaliacao.circunferencia_cintura} cm`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Contexto clínico ─────────────────────────────────── */}
        {relatorio.anamnese && (
          <section className="flex flex-col gap-3">
            <h3 className={TITULO_SECAO}>Informado pelo aluno na anamnese</h3>
            <dl className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200 text-sm">
              {(
                [
                  ["Objetivo", relatorio.anamnese.objetivo],
                  ["Condições", relatorio.anamnese.doencas?.join(", ")],
                  ["Medicamentos em uso", relatorio.anamnese.medicamentos_uso],
                  ["Alergias", relatorio.anamnese.alergias],
                  ["Lesões", relatorio.anamnese.lesoes],
                  [
                    "Restrições médicas",
                    relatorio.anamnese.restricoes_medicas,
                  ],
                ] as const
              )
                .filter(([, valor]) => valor)
                .map(([rotulo, valor]) => (
                  <div
                    key={rotulo}
                    className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4"
                  >
                    <dt className="shrink-0 text-neutral-500 sm:w-44">{rotulo}</dt>
                    <dd className="text-neutral-900">{valor}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}

        {/* ── Todas as medições ────────────────────────────────── */}
        {relatorio.registros.length > 0 && (
          <section className="flex flex-col gap-3 break-inside-avoid">
            <h3 className={TITULO_SECAO}>Medições do período</h3>

            <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
              <table className="w-full min-w-[440px] text-xs print:min-w-0">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500">
                    <th scope="col" className={cn(CABECA, "py-1.5")}>Data</th>
                    <th scope="col" className={cn(CABECA, "py-1.5")}>Indicador</th>
                    <th scope="col" className={cn(CABECA, "py-1.5")}>Valor</th>
                    <th scope="col" className={cn(CABECA, "py-1.5")}>Momento</th>
                    <th scope="col" className={cn(CABECA, "py-1.5")}>Faixa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {relatorio.registros.map((registro) => (
                    <tr key={registro.id}>
                      <td className="numero py-1.5 pr-4 whitespace-nowrap text-neutral-600">
                        {format(naAcademia(registro.registradoEm), "dd/MM HH:mm")}
                      </td>
                      <td className="py-1.5 pr-4">
                        {CONFIG_INDICADORES[registro.tipo].labelCurto}
                      </td>
                      <td className="numero py-1.5 pr-4 font-semibold whitespace-nowrap text-neutral-950">
                        {registro.valorFormatado}
                      </td>
                      <td className="py-1.5 pr-4 text-neutral-500">
                        {registro.momento ?? "—"}
                      </td>
                      <td className="py-1.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-px text-[10.5px] font-semibold",
                            CHIP_SEMAFORO[registro.status]
                          )}
                        >
                          {registro.status === "verde"
                            ? "Ideal"
                            : registro.status === "amarelo"
                              ? "Atenção"
                              : "Crítico"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="border-t border-neutral-200 pt-5 text-xs leading-relaxed text-neutral-500">
          <p>
            Dados registrados pelo próprio aluno no aplicativo da Central de
            Saúde Conectada e pelo professor responsável. Este documento é um
            resumo de acompanhamento e não constitui laudo ou diagnóstico
            médico.
          </p>
          {perfil.medico_nome && (
            <p className="mt-1.5">
              Médico de referência informado pelo aluno:{" "}
              <span className="text-neutral-700">{perfil.medico_nome}</span>
              {perfil.medico_telefone && ` · ${perfil.medico_telefone}`}
            </p>
          )}
        </footer>
      </article>
    </div>
  );
}

function Dado({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <li className="flex flex-col gap-1 bg-white p-4">
      <span className="numero text-[26px] leading-none font-semibold text-neutral-950">
        {valor}
      </span>
      <span className="text-xs leading-snug text-neutral-500">{rotulo}</span>
    </li>
  );
}
