import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { BotaoImprimir } from "@/components/aluno/BotaoImprimir";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getRelatorioMensal } from "@/lib/supabase/relatorio";
import { rotularCondicoes } from "@/lib/utils/avatares";
import { hojeISO, somarDiasISO } from "@/lib/utils/datas";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";
import { HUMOR_CONFIG } from "@/lib/utils/saudacao";

function nomeDoMes(mes: string) {
  return format(new Date(`${mes}-01T12:00:00Z`), "MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

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
    <div className="flex flex-col gap-6 px-5 py-6 md:px-8 md:py-8 print:px-0 print:py-0">
      {/* ── Controles (somem na impressão) ─────────────────────────── */}
      <div className="flex flex-col gap-3 print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Relatório para o médico
        </h1>
        <p className="text-sm text-neutral-500">
          Um resumo do mês para levar na consulta. Escolha o mês e salve em PDF.
        </p>

        <div className="flex flex-wrap gap-2">
          {opcoesMes.map((opcao) => (
            <a
              key={opcao}
              href={`/relatorio?mes=${opcao}`}
              aria-current={opcao === mes ? "page" : undefined}
              className={`rounded-xl border px-3.5 py-2.5 text-sm capitalize transition-colors ${
                opcao === mes
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {nomeDoMes(opcao)}
            </a>
          ))}
        </div>

        <BotaoImprimir />
      </div>

      {/* ── A folha ────────────────────────────────────────────────── */}
      <article className="flex flex-col gap-6 rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-col gap-1 border-b border-neutral-200 pb-4">
          <p className="text-xs tracking-wider text-neutral-500 uppercase">
            Central de Saúde Conectada
          </p>
          <h2 className="text-xl font-bold">
            Relatório de acompanhamento — <span className="capitalize">{nomeDoMes(mes)}</span>
          </h2>
          <p className="text-sm text-neutral-600">
            {perfil.nome} · {rotularCondicoes(perfil.avatar_condicao)}
            {perfil.data_nascimento &&
              ` · nascido em ${format(new Date(`${perfil.data_nascimento}T12:00:00Z`), "dd/MM/yyyy")}`}
          </p>
          <p className="text-xs text-neutral-500">
            Período de {format(new Date(`${relatorio.inicio}T12:00:00Z`), "dd/MM/yyyy")} a{" "}
            {format(new Date(`${relatorio.fim}T12:00:00Z`), "dd/MM/yyyy")} ·
            emitido em {format(new Date(`${hojeISO()}T12:00:00Z`), "dd/MM/yyyy")}
          </p>
        </header>

        {/* ── Indicadores ──────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold tracking-wider text-neutral-500 uppercase">
            Indicadores clínicos
          </h3>

          {relatorio.indicadores.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nenhuma medição registrada neste mês.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th scope="col" className="py-2 font-medium">Indicador</th>
                  <th scope="col" className="py-2 font-medium">Medições</th>
                  <th scope="col" className="py-2 font-medium">Média</th>
                  <th scope="col" className="py-2 font-medium">Mínimo</th>
                  <th scope="col" className="py-2 font-medium">Máximo</th>
                  <th scope="col" className="py-2 font-medium">Fora da faixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {relatorio.indicadores.map((resumo) => {
                  const config = CONFIG_INDICADORES[resumo.tipo];
                  const forA = resumo.amarelos + resumo.vermelhos;

                  return (
                    <tr key={resumo.tipo}>
                      <th scope="row" className="py-2 text-left font-medium">
                        {config.label}{" "}
                        <span className="font-normal text-neutral-500">
                          ({config.unidade})
                        </span>
                      </th>
                      <td className="py-2 tabular-nums">{resumo.medicoes}</td>
                      <td className="py-2 font-semibold tabular-nums">
                        {resumo.media.toFixed(1).replace(".", ",")}
                        {resumo.mediaSecundaria !== null &&
                          ` / ${resumo.mediaSecundaria.toFixed(1).replace(".", ",")}`}
                      </td>
                      <td className="py-2 tabular-nums">{resumo.minimo}</td>
                      <td className="py-2 tabular-nums">{resumo.maximo}</td>
                      <td className="py-2 tabular-nums">
                        {forA} de {resumo.medicoes}
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
          )}
        </section>

        {/* ── Frequência e esforço ─────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold tracking-wider text-neutral-500 uppercase">
            Atividade física
          </h3>

          <ul className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
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
            <h3 className="text-sm font-bold tracking-wider text-neutral-500 uppercase">
              Estado geral relatado
            </h3>
            <p className="text-sm text-neutral-600">
              {relatorio.diasComHumor}{" "}
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
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold tracking-wider text-neutral-500 uppercase">
              Avaliações físicas recentes
            </h3>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th scope="col" className="py-2 font-medium">Data</th>
                  <th scope="col" className="py-2 font-medium">Peso</th>
                  <th scope="col" className="py-2 font-medium">IMC</th>
                  <th scope="col" className="py-2 font-medium">% gordura</th>
                  <th scope="col" className="py-2 font-medium">Cintura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {relatorio.avaliacoes.map((avaliacao) => (
                  <tr key={avaliacao.id}>
                    <th scope="row" className="py-2 text-left font-medium">
                      {format(
                        new Date(`${avaliacao.data}T12:00:00Z`),
                        "dd/MM/yyyy"
                      )}
                    </th>
                    <td className="py-2 tabular-nums">
                      {avaliacao.peso ? `${avaliacao.peso} kg` : "—"}
                    </td>
                    <td className="py-2 tabular-nums">{avaliacao.imc ?? "—"}</td>
                    <td className="py-2 tabular-nums">
                      {avaliacao.percentual_gordura
                        ? `${avaliacao.percentual_gordura}%`
                        : "—"}
                    </td>
                    <td className="py-2 tabular-nums">
                      {avaliacao.circunferencia_cintura
                        ? `${avaliacao.circunferencia_cintura} cm`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Contexto clínico ─────────────────────────────────── */}
        {relatorio.anamnese && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold tracking-wider text-neutral-500 uppercase">
              Informado pelo aluno na anamnese
            </h3>
            <dl className="flex flex-col gap-1.5 text-sm">
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
                  <div key={rotulo} className="flex gap-2">
                    <dt className="shrink-0 font-medium text-neutral-500">
                      {rotulo}:
                    </dt>
                    <dd className="text-neutral-800">{valor}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}

        {/* ── Todas as medições ────────────────────────────────── */}
        {relatorio.registros.length > 0 && (
          <section className="flex flex-col gap-2 break-inside-avoid">
            <h3 className="text-sm font-bold tracking-wider text-neutral-500 uppercase">
              Medições do período
            </h3>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th scope="col" className="py-1.5 font-medium">Data</th>
                  <th scope="col" className="py-1.5 font-medium">Indicador</th>
                  <th scope="col" className="py-1.5 font-medium">Valor</th>
                  <th scope="col" className="py-1.5 font-medium">Momento</th>
                  <th scope="col" className="py-1.5 font-medium">Faixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {relatorio.registros.map((registro) => (
                  <tr key={registro.id}>
                    <td className="py-1.5 whitespace-nowrap tabular-nums">
                      {format(new Date(registro.registradoEm), "dd/MM HH:mm")}
                    </td>
                    <td className="py-1.5">
                      {CONFIG_INDICADORES[registro.tipo].labelCurto}
                    </td>
                    <td className="py-1.5 font-medium tabular-nums">
                      {registro.valorFormatado}
                    </td>
                    <td className="py-1.5 text-neutral-500">
                      {registro.momento ?? "—"}
                    </td>
                    <td className="py-1.5">
                      {registro.status === "verde"
                        ? "Ideal"
                        : registro.status === "amarelo"
                          ? "Atenção"
                          : "Crítico"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          <p>
            Dados registrados pelo próprio aluno no aplicativo da Central de
            Saúde Conectada e pelo professor responsável. Este documento é um
            resumo de acompanhamento e não constitui laudo ou diagnóstico
            médico.
          </p>
          {perfil.medico_nome && (
            <p className="mt-1">
              Médico de referência informado pelo aluno: {perfil.medico_nome}
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
    <li className="flex flex-col gap-0.5 rounded-lg border border-neutral-200 p-3">
      <span className="text-lg font-bold tabular-nums">{valor}</span>
      <span className="text-xs text-neutral-500">{rotulo}</span>
    </li>
  );
}
