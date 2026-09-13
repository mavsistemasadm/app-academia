import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight } from "lucide-react";

import { CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
import { cn } from "@/lib/utils";
import { hojeISO, horaAtual, somarDiasISO } from "@/lib/utils/datas";
import {
  CONFIG_INDICADORES,
  MOMENTO_LABEL,
  type RegistroIndicador,
} from "@/lib/utils/indicadores";
import { SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

interface HistoricoIndicadoresProps {
  registros: RegistroIndicador[];
  /** Data da academia, `YYYY-MM-DD` — calculada no servidor. */
  hoje: string;
}

/** Agrupa por dia da academia, preservando a ordem (mais recente primeiro). */
function agruparPorDia(registros: RegistroIndicador[]) {
  const grupos: { dia: string; registros: RegistroIndicador[] }[] = [];

  for (const registro of registros) {
    const dia = hojeISO(new Date(registro.registradoEm));
    const ultimo = grupos[grupos.length - 1];

    if (ultimo?.dia === dia) ultimo.registros.push(registro);
    else grupos.push({ dia, registros: [registro] });
  }

  return grupos;
}

function rotularDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  if (dia === somarDiasISO(hoje, -1)) return "Ontem";

  // Meio-dia UTC: qualquer fuso do servidor cai no mesmo dia do calendário.
  return format(new Date(`${dia}T12:00:00Z`), "EEEE, dd 'de' MMMM", {
    locale: ptBR,
  });
}

export function HistoricoIndicadores({
  registros,
  hoje,
}: HistoricoIndicadoresProps) {
  if (registros.length === 0) {
    return (
      <div className="flex flex-col gap-1.5 rounded-2xl bg-card px-5 py-6 ring-1 ring-neutral-200/90">
        <p className="text-[15px] font-semibold text-neutral-950">
          Ainda sem medição registrada
        </p>
        <p className="max-w-sm text-[15px] leading-relaxed text-neutral-500">
          Assim que você registrar a primeira, ela aparece aqui e seu professor
          passa a acompanhar.
        </p>
        <Link
          href="#registrar"
          className="mt-1 flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline underline-offset-4"
        >
          Registrar
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
      {agruparPorDia(registros).map(({ dia, registros: doDia }) => (
        <section key={dia}>
          <h3 className="rotulo bg-neutral-50 px-4 py-2 text-neutral-400 first-letter:uppercase md:px-5">
            {rotularDia(dia, hoje)}
          </h3>

          <ul className="divide-y divide-neutral-200/80">
            {doDia.map((registro) => {
              const config = CONFIG_INDICADORES[registro.tipo];
              const semaforo = SEMAFORO_CONFIG[registro.status];

              const legenda = [
                config.labelCurto,
                registro.momento ? MOMENTO_LABEL[registro.momento] : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li
                  key={registro.id}
                  className="flex items-center gap-3 px-4 py-3.5 md:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-500">
                      {legenda}
                    </p>
                    <p className="numero mt-0.5 text-[22px] leading-tight font-semibold text-neutral-950">
                      {registro.valorFormatado.replace(" kg", "")}
                      <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
                        {config.unidade}
                      </span>
                    </p>
                    {registro.observacao && (
                      <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
                        “{registro.observacao}”
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        CHIP_SEMAFORO[registro.status]
                      )}
                    >
                      {registro.badge || semaforo.label}
                    </span>
                    {/* `horaAtual` formata no fuso da academia, não no do servidor. */}
                    <span className="rotulo text-neutral-400">
                      {horaAtual(new Date(registro.registradoEm))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
