import { redirect } from "next/navigation";
import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CalendarDays, Users } from "lucide-react";

import { ConfirmarPresenca } from "@/components/aluno/ConfirmarPresenca";
import { getAgendaAluno, type EventoNaAgenda } from "@/lib/supabase/agenda";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { AVATAR_CONFIG } from "@/lib/utils/avatares";

function rotularQuando(evento: EventoNaAgenda) {
  const inicio = new Date(evento.dataInicio);

  const dia = isToday(inicio)
    ? "Hoje"
    : isTomorrow(inicio)
      ? "Amanhã"
      : format(inicio, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const hora = format(inicio, "HH:mm");
  const fim = evento.dataFim ? format(new Date(evento.dataFim), "HH:mm") : null;

  return `${dia} · ${hora}${fim ? ` às ${fim}` : ""}`;
}

export default async function AgendaPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { proximos, passados, notificacoes } = await getAgendaAluno(perfil);

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {proximos.length === 0
            ? "Nada marcado por enquanto."
            : `${proximos.length} ${proximos.length === 1 ? "evento" : "eventos"} pela frente.`}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Próximos ───────────────────────────────────────────── */}
        <section className="-mt-14 flex flex-col gap-3 md:mt-0">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase max-md:sr-only">
            Próximos eventos
          </h2>

          {proximos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <p className="text-base font-semibold text-neutral-900">
                Nenhum evento marcado
              </p>
              <p className="max-w-xs text-sm text-neutral-500">
                Aulas especiais, palestras e mutirões do centro aparecem aqui.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {proximos.map((evento) => (
                <li
                  key={evento.id}
                  className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="text-xs leading-none font-medium uppercase">
                        {format(new Date(evento.dataInicio), "MMM", {
                          locale: ptBR,
                        })}
                      </span>
                      <span className="text-base leading-tight font-bold">
                        {format(new Date(evento.dataInicio), "dd")}
                      </span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-neutral-900">
                        {evento.titulo}
                      </h3>
                      <p className="text-sm text-neutral-500 first-letter:uppercase">
                        {rotularQuando(evento)}
                      </p>
                      {evento.descricao && (
                        <p className="mt-1 text-sm text-neutral-600">
                          {evento.descricao}
                        </p>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {evento.totalConfirmados > 0 && (
                          <span className="flex items-center gap-1 text-xs text-neutral-500">
                            <Users className="size-3.5" aria-hidden />
                            {evento.totalConfirmados}{" "}
                            {evento.totalConfirmados === 1
                              ? "confirmado"
                              : "confirmados"}
                          </span>
                        )}
                        {!evento.paraTodos &&
                          evento.condicoes.map((condicao) => (
                            <span
                              key={condicao}
                              className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                            >
                              {AVATAR_CONFIG[condicao]?.label ?? condicao}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>

                  <ConfirmarPresenca
                    eventoId={evento.id}
                    alunoId={perfil.id}
                    confirmadoInicial={evento.confirmado}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Comunicados ────────────────────────────────────────── */}
        {notificacoes.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Comunicados do centro
            </h2>

            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {notificacoes.map((notificacao) => (
                <li key={notificacao.id} className="flex gap-3 p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Bell className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900">
                      {notificacao.titulo}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-600">
                      {notificacao.corpo}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      {format(
                        new Date(notificacao.created_at),
                        "dd/MM 'às' HH:mm"
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Já aconteceram ─────────────────────────────────────── */}
        {passados.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Já aconteceram
            </h2>

            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {passados.map((evento) => (
                <li key={evento.id} className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-600">
                      {evento.titulo}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {format(new Date(evento.dataInicio), "dd/MM/yyyy")}
                    </p>
                  </div>
                  {evento.confirmado && (
                    <span className="shrink-0 text-xs font-semibold text-saude-verde">
                      Você foi
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
