import type { Metadata } from "next";
import Image from "next/image";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, FileText, ImageIcon, ShieldCheck } from "lucide-react";

import { CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
import { cn } from "@/lib/utils";
import { DIAS_DE_MEDICOES, getExamesCompartilhados } from "@/lib/supabase/exames";
import { rotularCondicoes } from "@/lib/utils/avatares";
import { naAcademia } from "@/lib/utils/datas";
import { ehPdf, rotuloTipoExame } from "@/lib/utils/exames";
import { CONFIG_INDICADORES, MOMENTO_LABEL } from "@/lib/utils/indicadores";

// Cada visita valida o token de novo e gera URLs assinadas novas.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Resumo de saúde compartilhado",
  robots: { index: false, follow: false, nocache: true },
  // O token está na URL: não vaza no Referer quando o médico abre o arquivo.
  referrer: "no-referrer",
};

function dataISO(iso: string, padrao = "dd 'de' MMMM 'de' yyyy") {
  return format(new Date(`${iso}T12:00:00Z`), padrao, { locale: ptBR });
}

const TEXTO_STATUS = { verde: "Ideal", amarelo: "Atenção", vermelho: "Crítico" } as const;
const TITULO = "text-base font-semibold tracking-[-0.015em] text-neutral-950";
const CARD = "overflow-hidden rounded-2xl ring-1 ring-neutral-200/90";

function Logo() {
  return (
    <Image
      src="/marca/logo.png"
      alt="Atitude Vital, centro de treinamento"
      width={1000}
      height={336}
      priority
      sizes="144px"
      className="h-auto w-32 sm:w-36"
    />
  );
}

export default async function ExamesCompartilhadosPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const dados = await getExamesCompartilhados(token);

  if (!dados) {
    return (
      <main className="flex min-h-dvh flex-col bg-background px-5 py-10">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
          <Logo />
          <div className="flex flex-col gap-2 rounded-2xl bg-card p-6 ring-1 ring-neutral-200/90">
            <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.025em] text-neutral-950">
              Link indisponível
            </h1>
            <p className="text-[15px] leading-relaxed text-neutral-500">
              Este link expirou, foi cancelado pelo paciente ou não existe.
              Peça ao paciente que gere um novo pelo app.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { aluno, exames, expiraEm, medicoes, medicamentos, anamnese } = dados;

  // O último registro de cada indicador, na ordem em que o app apresenta.
  const ultimas = (Object.keys(CONFIG_INDICADORES) as (keyof typeof CONFIG_INDICADORES)[])
    .map((tipo) => medicoes.find((m) => m.tipo === tipo))
    .filter((m) => m !== undefined);
  const condicoes = aluno.avatar_condicao?.length
    ? rotularCondicoes(aluno.avatar_condicao)
    : null;

  return (
    <main className="min-h-dvh bg-background px-5 py-8 md:py-12">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-7 rounded-2xl bg-white p-5 text-neutral-900 ring-1 ring-neutral-200/90 sm:p-8 md:p-10">
        <header className="flex flex-col gap-1.5 border-b border-neutral-200 pb-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Logo />
            <p className="rotulo text-right text-neutral-400">
              Central de Saúde Conectada
            </p>
          </div>
          <p className="rotulo text-neutral-400">Resumo de saúde compartilhado</p>
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.025em] text-neutral-950 sm:text-[28px]">
            {aluno.nome}
          </h1>
          {(aluno.data_nascimento || condicoes) && (
            <p className="mt-1 text-[15px] text-neutral-600">
              {[
                aluno.data_nascimento
                  ? `Nascimento: ${dataISO(aluno.data_nascimento, "dd/MM/yyyy")}`
                  : null,
                condicoes,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </header>

        <div className="flex items-start gap-3 rounded-[14px] bg-neutral-50 px-4 py-3.5 ring-1 ring-neutral-200/80">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
          <p className="text-sm leading-relaxed text-neutral-600">
            Link compartilhado pelo próprio paciente pelo app Atitude Vital
            {expiraEm
              ? `, válido até ${format(naAcademia(expiraEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
              : ""}
            . Medições e medicamentos são registrados pelo próprio paciente no
            app. Os arquivos de exame abrem por tempo limitado: se algum não
            abrir, recarregue a página.
          </p>
        </div>

        {anamnese.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className={TITULO}>Informado pelo paciente na anamnese</h2>
            <dl className={cn(CARD, "divide-y divide-neutral-200/80 px-4 md:px-5")}>
              {anamnese.map(({ pergunta, resposta }) => (
                <div key={pergunta} className="grid gap-0.5 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-[13px] font-medium text-neutral-500">{pergunta}</dt>
                  <dd className="text-[15px] leading-relaxed text-neutral-950">{resposta}</dd>
                </div>
              ))}
            </dl>
            {dados.anamneseAtualizadaEm && (
              <p className="rotulo text-neutral-400">
                Atualizada em {format(naAcademia(dados.anamneseAtualizadaEm), "dd/MM/yyyy")}
              </p>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className={TITULO}>
            {medicamentos.length === 0 ? "Nenhum medicamento cadastrado no app" : "Medicamentos em uso"}
          </h2>
          {medicamentos.length > 0 && (
            <ul className={cn(CARD, "divide-y divide-neutral-200/80")}>
              {medicamentos.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 md:px-5">
                  <p className="text-[15px] font-semibold text-neutral-950">
                    {m.nome}
                    {m.dose && <span className="font-normal text-neutral-600"> · {m.dose}</span>}
                  </p>
                  <p className="rotulo text-neutral-500">
                    {m.horarios.map((h) => h.slice(0, 5)).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={TITULO}>
            {medicoes.length === 0
              ? `Nenhuma medição nos últimos ${DIAS_DE_MEDICOES} dias`
              : `Medições dos últimos ${DIAS_DE_MEDICOES} dias`}
          </h2>

          {ultimas.length > 0 && (
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ultimas.map((m) => (
                <li key={m.id} className="flex flex-col gap-1.5 rounded-2xl px-4 py-3.5 ring-1 ring-neutral-200/90">
                  <p className="rotulo text-neutral-400">{CONFIG_INDICADORES[m.tipo].labelCurto}, a última</p>
                  <p className="numero text-[24px] leading-none font-semibold text-neutral-950">
                    {m.valorFormatado.replace(" kg", "")}
                    <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
                      {CONFIG_INDICADORES[m.tipo].unidade}
                    </span>
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-px text-[11px] font-semibold", CHIP_SEMAFORO[m.status])}>
                      {TEXTO_STATUS[m.status]}
                    </span>
                    <span className="text-[12px] text-neutral-500">
                      {format(naAcademia(m.registradoEm), "dd/MM")}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {medicoes.length > 0 && (
            <details className={cn(CARD, "group")}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary md:px-5">
                Ver as {medicoes.length} medições
              </summary>
              <div className="overflow-x-auto border-t border-neutral-200/80">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-neutral-50 text-[12px] text-neutral-500">
                    <tr>
                      <th className="px-4 py-2 font-medium md:px-5">Data</th>
                      <th className="px-2 py-2 font-medium">Indicador</th>
                      <th className="px-2 py-2 font-medium">Valor</th>
                      <th className="px-2 py-2 font-medium">Momento</th>
                      <th className="px-4 py-2 font-medium md:px-5">Faixa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/80">
                    {medicoes.map((m) => (
                      <tr key={m.id}>
                        <td className="numero px-4 py-2 whitespace-nowrap text-neutral-600 md:px-5">
                          {format(naAcademia(m.registradoEm), "dd/MM/yy HH:mm")}
                        </td>
                        <td className="px-2 py-2 text-neutral-700">{CONFIG_INDICADORES[m.tipo].labelCurto}</td>
                        <td className="numero px-2 py-2 font-semibold whitespace-nowrap text-neutral-950">
                          {m.valorFormatado.replace(" kg", "")} {CONFIG_INDICADORES[m.tipo].unidade}
                        </td>
                        <td className="px-2 py-2 text-neutral-600">
                          {m.momento ? MOMENTO_LABEL[m.momento] : "Não informado"}
                        </td>
                        <td className="px-4 py-2 md:px-5">
                          <span className={cn("rounded-full px-2 py-px text-[11px] font-semibold", CHIP_SEMAFORO[m.status])}>
                            {TEXTO_STATUS[m.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-[-0.015em] text-neutral-950">
            {exames.length === 0
              ? "Nenhum exame enviado"
              : `${exames.length} ${exames.length === 1 ? "exame" : "exames"}, do mais recente ao mais antigo`}
          </h2>

          {exames.length > 0 && (
            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl ring-1 ring-neutral-200/90">
              {exames.map((exame) => {
                const Icone = ehPdf(exame.mime) ? FileText : ImageIcon;

                return (
                  <li
                    key={exame.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 md:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3.5">
                      <Icone className="mt-0.5 size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600">
                            {rotuloTipoExame(exame)}
                          </span>
                          <span className="rotulo text-neutral-400">
                            {dataISO(exame.data_exame, "dd/MM/yyyy")}
                          </span>
                        </div>
                        <p className="text-[15px] font-semibold break-words text-neutral-950">
                          {exame.titulo || rotuloTipoExame(exame)}
                        </p>
                        {exame.observacao && (
                          <p className="text-sm leading-relaxed text-neutral-600">
                            {exame.observacao}
                          </p>
                        )}
                      </div>
                    </div>

                    {exame.url ? (
                      <a
                        href={exame.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-grafite px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98]"
                      >
                        <ExternalLink className="size-4" strokeWidth={1.8} aria-hidden />
                        Abrir exame
                      </a>
                    ) : (
                      <span className="text-[13px] text-neutral-400">
                        Arquivo indisponível
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </article>
    </main>
  );
}
