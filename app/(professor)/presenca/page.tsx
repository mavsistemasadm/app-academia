import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronRight, MapPin, UserRound } from "lucide-react";

import { CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { DIAS_PARA_ALERTA_DE_SUMICO } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getPresencaProfessor } from "@/lib/supabase/presenca";
import { cn } from "@/lib/utils";
import { horaAtual } from "@/lib/utils/datas";

/** Quantos rostos cabem na pilha antes de virar "+n". */
const MAX_AVATARES = 7;

function Avatar({
  nome,
  foto,
  className,
}: {
  nome?: string;
  foto?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 font-semibold text-neutral-500",
        className
      )}
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="size-full object-cover" />
      ) : nome ? (
        nome.charAt(0).toUpperCase()
      ) : (
        <UserRound className="size-5" aria-hidden />
      )}
    </span>
  );
}

export default async function PresencaPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { presentes, sumidos, porDia, totalNoMes } = await getPresencaProfessor(
    DIAS_PARA_ALERTA_DE_SUMICO
  );

  const maximo = Math.max(1, ...porDia.map((d) => d.total));
  const mediaDia =
    porDia.length > 0
      ? porDia.reduce((soma, d) => soma + d.total, 0) / porDia.length
      : 0;

  const rotuloDia = (data: string, formato: string) =>
    format(new Date(`${data}T12:00:00Z`), formato, { locale: ptBR });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-7 px-4 py-6 md:gap-9 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Frequência"
          titulo="Presença"
          descricao="Quem está treinando agora, quem sumiu e como anda o movimento do mês."
        />
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-2 lg:gap-6">
        {/* ── Na academia agora ────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Na academia agora
          </h2>

          <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
            <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5">
              <p className="numero text-[44px] leading-none font-semibold text-neutral-950">
                {presentes.length}
                <span className="ml-1.5 font-sans text-sm font-medium tracking-normal text-neutral-400">
                  {presentes.length === 1 ? "aluno" : "alunos"}
                </span>
              </p>

              {presentes.length > 0 && (
                <div aria-hidden className="flex -space-x-2.5">
                  {presentes.slice(0, MAX_AVATARES).map((checkin) => (
                    <Avatar
                      key={checkin.id}
                      nome={checkin.aluno?.nome}
                      foto={checkin.aluno?.foto_url}
                      className="size-10 text-sm ring-[3px] ring-white"
                    />
                  ))}
                  {presentes.length > MAX_AVATARES && (
                    <span className="numero flex size-10 items-center justify-center rounded-full bg-grafite text-[13px] font-semibold text-white ring-[3px] ring-white">
                      +{presentes.length - MAX_AVATARES}
                    </span>
                  )}
                </div>
              )}
            </div>

            {presentes.length === 0 ? (
              <p className="flex items-start gap-2.5 border-t border-neutral-200/80 px-5 py-4 text-sm leading-relaxed text-neutral-500">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-neutral-400"
                  strokeWidth={1.8}
                  aria-hidden
                />
                Nenhum check-in aberto. Os alunos batem o ponto pelo app ao chegar.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200/80 border-t border-neutral-200/80">
                {presentes.map((checkin) => (
                  <li key={checkin.id}>
                    <Link
                      href={`/alunos/${checkin.aluno_id}`}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-50"
                    >
                      <Avatar
                        nome={checkin.aluno?.nome}
                        foto={checkin.aluno?.foto_url}
                        className="size-9 text-sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-neutral-950">
                        {checkin.aluno?.nome ?? "Aluno"}
                      </span>
                      {/* Formatado no fuso da academia: o servidor roda em UTC. */}
                      <span className="rotulo shrink-0 text-neutral-400">
                        desde {horaAtual(new Date(checkin.entrada))}
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Sumidos ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
              Sumidos há {DIAS_PARA_ALERTA_DE_SUMICO}+ dias
            </h2>
            {sumidos.length > 0 && (
              <span className="rotulo text-neutral-400">
                {sumidos.length} {sumidos.length === 1 ? "aluno" : "alunos"}
              </span>
            )}
          </div>

          {sumidos.length === 0 ? (
            <div className="flex items-start gap-3 rounded-2xl bg-card px-5 py-5 ring-1 ring-neutral-200/90">
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-saude-verde"
                strokeWidth={1.8}
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-neutral-500">
                <span className="block text-[15px] font-semibold text-neutral-950">
                  Ninguém sumido
                </span>
                Todo mundo apareceu nos últimos {DIAS_PARA_ALERTA_DE_SUMICO} dias.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {sumidos.map(({ perfil: aluno, diasSemAparecer }) => {
                // O dobro do prazo de sumiço — ou sem registro nenhum — já pede ligação hoje.
                const grave =
                  diasSemAparecer === null ||
                  diasSemAparecer >= DIAS_PARA_ALERTA_DE_SUMICO * 2;

                return (
                  <li key={aluno.id}>
                    <Link
                      href={`/alunos/${aluno.id}`}
                      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-neutral-50 md:px-5"
                    >
                      <Avatar nome={aluno.nome} foto={aluno.foto_url} className="size-10 text-sm" />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-neutral-950">
                          {aluno.nome}
                        </p>
                        <p className="truncate text-[13px] text-neutral-500">
                          {aluno.telefone
                            ? "Ligue para saber como está"
                            : "Sem telefone cadastrado"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {diasSemAparecer === null ? (
                          <span className="text-[13px] font-medium text-neutral-500">
                            Nunca veio
                          </span>
                        ) : (
                          <p className="numero text-xl leading-none font-semibold text-neutral-950">
                            {diasSemAparecer}
                            <span className="ml-0.5 font-sans text-[11px] font-medium tracking-normal text-neutral-400">
                              dias
                            </span>
                          </p>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            CHIP_SEMAFORO[grave ? "vermelho" : "amarelo"]
                          )}
                        >
                          {grave ? "Ligar hoje" : "Atenção"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── Movimento ────────────────────────────────────────────────── */}
      {porDia.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Movimento dos últimos 30 dias
          </h2>

          <div className="rounded-2xl bg-card px-5 py-5 ring-1 ring-neutral-200/90 md:px-6">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="rotulo text-neutral-400">Presenças no mês</p>
                <p className="numero mt-1.5 text-[28px] leading-none font-semibold text-neutral-950 md:text-[32px]">
                  {totalNoMes}
                </p>
              </div>
              <div>
                <p className="rotulo text-neutral-400">Média por dia</p>
                <p className="numero mt-1.5 text-[28px] leading-none font-semibold text-neutral-950 md:text-[32px]">
                  {mediaDia.toFixed(1).replace(".", ",")}
                </p>
              </div>
              <div>
                <p className="rotulo text-neutral-400">Pico</p>
                <p className="numero mt-1.5 text-[28px] leading-none font-semibold text-neutral-950 md:text-[32px]">
                  {maximo}
                </p>
              </div>
            </div>

            {/* Barras do mais antigo (esquerda) ao mais recente (direita). */}
            <ul
              aria-label="Presenças por dia"
              className="mt-6 flex h-36 items-end gap-[3px] md:h-44 md:gap-1.5"
            >
              {porDia.map(({ data, total }) => (
                <li
                  key={data}
                  title={`${rotuloDia(data, "EEE, dd/MM")}: ${total}`}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                >
                  <span className="sr-only">
                    {rotuloDia(data, "EEEE, dd/MM")}: {total}{" "}
                    {total === 1 ? "presença" : "presenças"}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "block w-full max-w-2 rounded-full",
                      total > 0 ? "bg-ciano" : "bg-neutral-200"
                    )}
                    style={{
                      height: total > 0 ? `${Math.max(4, (total / maximo) * 100)}%` : "4px",
                    }}
                  />
                </li>
              ))}
            </ul>

            <div aria-hidden className="mt-2.5 flex justify-between border-t border-neutral-200/80 pt-2.5">
              <span className="rotulo text-neutral-400">{rotuloDia(porDia[0].data, "dd/MM")}</span>
              <span className="rotulo text-neutral-400">
                {rotuloDia(porDia[Math.floor(porDia.length / 2)].data, "dd/MM")}
              </span>
              <span className="rotulo text-neutral-400">
                {rotuloDia(porDia[porDia.length - 1].data, "dd/MM")}
              </span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
