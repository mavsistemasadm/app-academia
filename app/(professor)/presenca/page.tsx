import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, UserRound } from "lucide-react";

import { DIAS_PARA_ALERTA_DE_SUMICO } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getPresencaProfessor } from "@/lib/supabase/presenca";

export default async function PresencaPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { presentes, sumidos, porDia, totalNoMes } = await getPresencaProfessor(
    DIAS_PARA_ALERTA_DE_SUMICO
  );

  const maximo = Math.max(1, ...porDia.map((d) => d.total));

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Presença
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {presentes.length === 0
            ? "Ninguém na academia neste momento."
            : `${presentes.length} ${presentes.length === 1 ? "aluno" : "alunos"} na academia agora.`}
        </p>
      </header>

      {/* ── Na academia agora ──────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Agora
        </h2>

        {presentes.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
              <MapPin className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-neutral-500">
              Nenhum check-in aberto. Os alunos batem o ponto pelo app ao
              chegar.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {presentes.map((checkin) => (
              <li key={checkin.id}>
                <Link
                  href={`/alunos/${checkin.aluno_id}`}
                  className="flex items-center gap-3 rounded-xl border border-saude-verde/40 bg-saude-verde-light/30 p-3.5 transition-shadow hover:shadow-sm"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-neutral-500">
                    {checkin.aluno?.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={checkin.aluno.foto_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      checkin.aluno?.nome.charAt(0).toUpperCase() ?? (
                        <UserRound className="size-5" aria-hidden />
                      )
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {checkin.aluno?.nome ?? "Aluno"}
                    </p>
                    <p className="text-xs text-neutral-600">
                      Desde {format(new Date(checkin.entrada), "HH:mm")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Sumidos ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Sem aparecer há {DIAS_PARA_ALERTA_DE_SUMICO}+ dias
        </h2>

        {sumidos.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-saude-verde">
            Ninguém sumido. Todo mundo apareceu na última semana.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {sumidos.map(({ perfil: aluno, diasSemAparecer }) => (
              <li key={aluno.id}>
                <Link
                  href={`/alunos/${aluno.id}`}
                  className="flex items-center gap-3 p-3.5 transition-colors hover:bg-neutral-50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-semibold text-neutral-500">
                    {aluno.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={aluno.foto_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      aluno.nome.charAt(0).toUpperCase()
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {aluno.nome}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {aluno.telefone
                        ? "Ligue para saber como está"
                        : "Sem telefone cadastrado"}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-md bg-saude-amarelo-light px-2 py-0.5 text-xs font-semibold text-saude-amarelo">
                    {diasSemAparecer === null
                      ? "Nunca veio"
                      : `${diasSemAparecer} dias`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Movimento ──────────────────────────────────────────────── */}
      {porDia.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Movimento dos últimos 30 dias
            </h2>
            <span className="text-sm text-neutral-500">
              {totalNoMes} presenças no mês
            </span>
          </div>

          <ul className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-white p-4">
            {porDia
              .slice()
              .reverse()
              .map(({ data, total }) => (
                <li key={data} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-neutral-500">
                    {format(new Date(`${data}T12:00:00Z`), "EEE, dd/MM", {
                      locale: ptBR,
                    })}
                  </span>
                  <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((total / maximo) * 100)}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right text-sm text-neutral-900 tabular-nums">
                    {total}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
