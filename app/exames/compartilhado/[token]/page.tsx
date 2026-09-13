import type { Metadata } from "next";
import Image from "next/image";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, FileText, ImageIcon, ShieldCheck } from "lucide-react";

import { getExamesCompartilhados } from "@/lib/supabase/exames";
import { rotularCondicoes } from "@/lib/utils/avatares";
import { naAcademia } from "@/lib/utils/datas";
import { ehPdf, rotuloTipoExame } from "@/lib/utils/exames";

// Cada visita valida o token de novo e gera URLs assinadas novas.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Exames compartilhados",
  robots: { index: false, follow: false, nocache: true },
  // O token está na URL: não vaza no Referer quando o médico abre o arquivo.
  referrer: "no-referrer",
};

function dataISO(iso: string, padrao = "dd 'de' MMMM 'de' yyyy") {
  return format(new Date(`${iso}T12:00:00Z`), padrao, { locale: ptBR });
}

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

  const { aluno, exames, expiraEm } = dados;
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
          <p className="rotulo text-neutral-400">Exames compartilhados</p>
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.025em] text-neutral-950 sm:text-[28px]">
            Exames de {aluno.nome}
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
            . Os arquivos abrem por tempo limitado. Se algum não abrir,
            recarregue a página.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-[-0.015em] text-neutral-950">
            {exames.length === 0
              ? "Nenhum exame enviado ainda"
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
