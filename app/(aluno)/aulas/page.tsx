import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckCircle2, History } from "lucide-react";

import { MarcarAula } from "@/components/aluno/MarcarAula";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { cn } from "@/lib/utils";
import { getAgendaDoAluno, getMinhasAulas } from "@/lib/supabase/aulas";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";
import { horaAtual, naAcademia } from "@/lib/utils/datas";
import { horaCurta, horaFim } from "@/lib/utils/aulas";

const CARD_LISTA =
  "divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90";

function diaPorExtenso(iso: string, hoje: string) {
  if (iso === hoje) return "Hoje";
  const data = new Date(`${iso}T12:00:00Z`);
  return format(data, "EEEE, d 'de' MMMM", { locale: ptBR });
}

export default async function AulasPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const supabase = await createClient();
  const [{ aulas, indisponivel, hoje }, minhas] = await Promise.all([
    getAgendaDoAluno(),
    getMinhasAulas(supabase, perfil.id),
  ]);

  // Instante do servidor no fuso da academia: o relógio do celular pode mentir.
  const agoraISO = naAcademia(new Date()).toISOString();
  const horaAgora = horaAtual();

  // Some da agenda o que já começou hoje: ninguém marca aula que passou.
  const disponiveis = aulas.filter(
    (a) => a.data > hoje || horaCurta(a.hora) > horaAgora
  );

  const porDia = disponiveis.reduce<Record<string, typeof disponiveis>>((mapa, aula) => {
    (mapa[aula.data] ??= []).push(aula);
    return mapa;
  }, {});

  const proximas = minhas.filter((m) => m.data >= hoje);
  const passadas = minhas.filter((m) => m.data < hoje);

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Aulas"
        titulo="Marcar aula"
        descricao="Escolha o dia e o horário. A vaga é sua assim que você marca, e dá para desmarcar se precisar."
      />

      <div className="flex flex-col gap-8 px-5 md:px-0">
        {indisponivel && (
          <p className="rounded-2xl bg-card px-5 py-5 text-[15px] leading-relaxed text-neutral-500 ring-1 ring-neutral-200/90">
            As aulas estão sendo ativadas. Volte daqui a pouco.
          </p>
        )}

        {proximas.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
              Suas próximas aulas
            </h2>
            <ul className={CARD_LISTA}>
              {[...proximas].reverse().map((aula) => (
                <li key={aula.id} className="flex items-center gap-4 px-4 py-3.5 md:px-5">
                  <div className="w-14 shrink-0 border-r border-neutral-200/80 pr-3">
                    <p className="rotulo text-primary">
                      {format(new Date(`${aula.data}T12:00:00Z`), "EEE", { locale: ptBR })}
                    </p>
                    <p className="numero mt-0.5 text-[20px] leading-none font-semibold text-neutral-950">
                      {format(new Date(`${aula.data}T12:00:00Z`), "dd")}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-neutral-950">{aula.titulo}</p>
                    <p className="mt-0.5 text-[13px] text-neutral-500">
                      {horaCurta(aula.hora)} às {horaFim(aula.hora, aula.duracaoMin)}
                      {aula.local ? ` · ${aula.local}` : ""}
                    </p>
                  </div>
                  {aula.cancelada ? (
                    <span className="shrink-0 rounded-full bg-saude-vermelho-light px-2.5 py-0.5 text-[11px] font-semibold text-saude-vermelho">
                      Cancelada
                    </span>
                  ) : (
                    <CheckCircle2
                      className="size-5 shrink-0 text-saude-verde"
                      strokeWidth={1.9}
                      aria-label="Vaga garantida"
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Próximos dias
          </h2>

          {Object.keys(porDia).length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
              <CalendarDays className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
              <p className="text-[15px] font-semibold text-neutral-950">Nenhuma aula na grade</p>
              <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
                Quando o centro publicar os horários da semana, eles aparecem aqui para você marcar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {Object.entries(porDia).map(([dia, doDia]) => (
                <div key={dia} className="flex flex-col gap-2.5">
                  <p className="rotulo text-neutral-400 first-letter:uppercase">
                    {diaPorExtenso(dia, hoje)}
                  </p>
                  <ul className={CARD_LISTA}>
                    {doDia.map((aula) => (
                      <MarcarAula
                        key={`${aula.horarioId}:${aula.data}`}
                        aula={aula}
                        alunoId={perfil.id}
                        agoraISO={agoraISO}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {passadas.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
                Histórico
              </h2>
              <p className="rotulo text-neutral-400">
                {passadas.length} {passadas.length === 1 ? "aula" : "aulas"}
              </p>
            </div>
            <ul className={cn(CARD_LISTA, "text-sm")}>
              {passadas.slice(0, 30).map((aula) => (
                <li key={aula.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <History className="size-4 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
                  <p className="min-w-0 flex-1 truncate text-neutral-700">{aula.titulo}</p>
                  <p className="rotulo shrink-0 text-neutral-400">
                    {format(new Date(`${aula.data}T12:00:00Z`), "dd/MM")} · {horaCurta(aula.hora)}
                  </p>
                  {aula.cancelada && (
                    <span className="shrink-0 text-[11px] font-semibold text-neutral-400">
                      cancelada
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
