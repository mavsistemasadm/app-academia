import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CalendarClock, CheckCircle2 } from "lucide-react";

import type { AulaNoDia, MinhaAula } from "@/lib/supabase/aulas";
import { horaCurta, horaFim, vagasRestantes } from "@/lib/utils/aulas";

/**
 * O primeiro cartão da home: marcar aula. Quando o aluno já tem aula
 * marcada, o cartão vira lembrete dela — continua levando para a mesma tela.
 */
export function CardAulas({
  aulas,
  minhas,
  hoje,
  horaAgora,
  indisponivel,
}: {
  aulas: AulaNoDia[];
  minhas: MinhaAula[];
  hoje: string;
  horaAgora: string;
  indisponivel: boolean;
}) {
  if (indisponivel) return null;

  const proxima = [...minhas]
    .filter((m) => !m.cancelada && (m.data > hoje || horaCurta(m.hora) > horaAgora))
    .sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`))[0];

  const abertas = aulas.filter(
    (a) =>
      !a.cancelada &&
      !a.estouInscrito &&
      vagasRestantes(a.vagas, a.ocupadas) > 0 &&
      (a.data > hoje || horaCurta(a.hora) > horaAgora)
  );
  const hojeComVaga = abertas.filter((a) => a.data === hoje);

  // Sem grade publicada não há o que oferecer.
  if (!proxima && abertas.length === 0) return null;

  const quando = proxima
    ? proxima.data === hoje
      ? `hoje às ${horaCurta(proxima.hora)}`
      : `${format(new Date(`${proxima.data}T12:00:00Z`), "EEEE, d 'de' MMMM", { locale: ptBR })} às ${horaCurta(proxima.hora)}`
    : null;

  return (
    <section className="flex flex-col gap-4 rounded-[26px] bg-card p-5 ring-1 ring-neutral-200/90 md:flex-row md:items-center md:justify-between md:p-6">
      <div className="flex min-w-0 items-start gap-4">
        <CalendarClock className="mt-0.5 size-6 shrink-0 text-primary" strokeWidth={1.8} aria-hidden />

        <div className="min-w-0">
          <p className="rotulo text-neutral-400">Aulas</p>

          {proxima ? (
            <>
              <h2 className="mt-1.5 text-[19px] leading-tight font-semibold tracking-[-0.02em] text-neutral-950 md:text-[22px]">
                {proxima.titulo}, {quando}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[15px] leading-relaxed text-neutral-500">
                <CheckCircle2 className="size-4 shrink-0 text-saude-verde" strokeWidth={1.9} aria-hidden />
                Sua vaga está garantida até {horaFim(proxima.hora, proxima.duracaoMin)}
                {proxima.local ? ` · ${proxima.local}` : ""}
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-1.5 text-[19px] leading-tight font-semibold tracking-[-0.02em] text-neutral-950 md:text-[22px]">
                Marque sua aula
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
                {hojeComVaga.length > 0
                  ? `${hojeComVaga.length} ${hojeComVaga.length === 1 ? "horário com vaga" : "horários com vaga"} ainda hoje, e mais nos próximos dias.`
                  : `${abertas.length} ${abertas.length === 1 ? "horário com vaga" : "horários com vaga"} nos próximos dias. Escolha o seu.`}
              </p>
            </>
          )}
        </div>
      </div>

      <Link
        href="/aulas"
        className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-grafite px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98]"
      >
        {proxima ? "Ver minhas aulas" : "Marcar aula"}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </section>
  );
}
