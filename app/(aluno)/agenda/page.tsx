import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Users } from "lucide-react";

import { ConfirmarPresenca } from "@/components/aluno/ConfirmarPresenca";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getAgendaAluno, type EventoNaAgenda } from "@/lib/supabase/agenda";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { AVATAR_CONFIG } from "@/lib/utils/avatares";
import { hojeISO, naAcademia, somarDiasISO } from "@/lib/utils/datas";

// Server component: sem `naAcademia`, a Vercel (UTC) mostraria 3h a mais.
function rotularQuando(evento: EventoNaAgenda) {
  const inicio = naAcademia(evento.dataInicio);
  const diaDoEvento = hojeISO(new Date(evento.dataInicio));
  const hoje = hojeISO();

  const dia =
    diaDoEvento === hoje
      ? "Hoje"
      : diaDoEvento === somarDiasISO(hoje, 1)
        ? "Amanhã"
        : format(inicio, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const hora = format(inicio, "HH:mm");
  const fim = evento.dataFim ? format(naAcademia(evento.dataFim), "HH:mm") : null;

  return `${dia} · ${hora}${fim ? ` às ${fim}` : ""}`;
}

const TITULO_SECAO =
  "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";

export default async function AgendaPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { proximos, passados, notificacoes } = await getAgendaAluno(perfil);

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Centro"
        titulo="Agenda"
        descricao={
          proximos.length === 0
            ? "Nada marcado por enquanto."
            : `${proximos.length} ${proximos.length === 1 ? "evento" : "eventos"} pela frente.`
        }
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Próximos ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className={TITULO_SECAO}>Próximos eventos</h2>

          {proximos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
              <CalendarDays className="size-7 text-neutral-400" strokeWidth={1.8} aria-hidden />
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-neutral-950">
                Nenhum evento marcado
              </p>
              <p className="max-w-xs text-[15px] leading-relaxed text-neutral-500">
                Aulas especiais, palestras e mutirões do centro aparecem aqui,
                com botão para confirmar presença.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {proximos.map((evento) => (
                <li key={evento.id} className="flex gap-4 p-5">
                  <div className="flex w-12 shrink-0 flex-col items-center pt-0.5 text-center">
                    <span className="numero text-[32px] leading-none font-semibold text-neutral-950">
                      {format(naAcademia(evento.dataInicio), "dd")}
                    </span>
                    <span className="rotulo mt-1.5 text-primary">
                      {format(naAcademia(evento.dataInicio), "MMM", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg leading-snug font-semibold tracking-[-0.02em] text-neutral-950">
                        {evento.titulo}
                      </h3>
                      <p className="mt-0.5 text-sm text-neutral-500 first-letter:uppercase">
                        {rotularQuando(evento)}
                      </p>
                      {evento.descricao && (
                        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
                          {evento.descricao}
                        </p>
                      )}

                      {(evento.totalConfirmados > 0 ||
                        (!evento.paraTodos && evento.condicoes.length > 0)) && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          {evento.totalConfirmados > 0 && (
                            <span className="flex items-center gap-1.5 text-[13px] text-neutral-500">
                              <Users className="size-3.5 text-neutral-400" strokeWidth={1.8} aria-hidden />
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
                                className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600"
                              >
                                {AVATAR_CONFIG[condicao]?.label ?? condicao}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>

                    <ConfirmarPresenca
                      eventoId={evento.id}
                      alunoId={perfil.id}
                      confirmadoInicial={evento.confirmado}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Comunicados ────────────────────────────────────────── */}
        {notificacoes.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <h2 className={TITULO_SECAO}>Comunicados do centro</h2>

            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {notificacoes.map((notificacao) => (
                <li key={notificacao.id} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-[15px] font-semibold text-neutral-950">
                      {notificacao.titulo}
                    </p>
                    <span className="rotulo shrink-0 text-neutral-400">
                      {format(naAcademia(notificacao.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                    {notificacao.corpo}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Já aconteceram ─────────────────────────────────────── */}
        {passados.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <h2 className={TITULO_SECAO}>Já aconteceram</h2>

            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {passados.map((evento) => (
                <li key={evento.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="rotulo w-12 shrink-0 text-neutral-400">
                    {format(naAcademia(evento.dataInicio), "dd/MM")}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-600">
                    {evento.titulo}
                  </p>
                  {evento.confirmado && (
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-neutral-600">
                      <span className="size-1.5 rounded-full bg-saude-verde" aria-hidden />
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
