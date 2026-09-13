import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History } from "lucide-react";

import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { hojeISO, horaAtual, somarDiasISO } from "@/lib/utils/datas";
import {
  CONFIG_INDICADORES,
  MOMENTO_LABEL,
  type RegistroIndicador,
} from "@/lib/utils/indicadores";
import { SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const PONTO_SEMAFORO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde",
  amarelo: "bg-saude-amarelo",
  vermelho: "bg-saude-vermelho",
};

const TEXTO_SEMAFORO: Record<SemaforoStatus, string> = {
  verde: "text-saude-verde",
  amarelo: "text-saude-amarelo",
  vermelho: "text-saude-vermelho",
};

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
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <History className="size-5" aria-hidden />
        </span>
        <p className="text-base font-semibold text-neutral-900">
          Nenhuma medição registrada
        </p>
        <p className="max-w-xs text-sm text-neutral-500">
          Assim que você registrar a primeira, ela aparece aqui e seu professor
          passa a acompanhar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {agruparPorDia(registros).map(({ dia, registros: doDia }) => (
        <section key={dia} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            {rotularDia(dia, hoje)}
          </h3>

          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {doDia.map((registro) => {
              const config = CONFIG_INDICADORES[registro.tipo];
              const Icone = config.icone;
              const semaforo = SEMAFORO_CONFIG[registro.status];

              const detalhes = [
                horaAtual(new Date(registro.registradoEm)),
                registro.momento ? MOMENTO_LABEL[registro.momento] : null,
                registro.badge || null,
              ].filter(Boolean);

              return (
                <li key={registro.id} className="flex items-center gap-3 p-3.5">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      config.corIcone
                    )}
                  >
                    <Icone className="size-5" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900">
                      {config.labelCurto}{" "}
                      <span className="tabular-nums">
                        {registro.valorFormatado}
                      </span>
                      {registro.tipo !== "peso" && ` ${config.unidade}`}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {detalhes.join(" · ")}
                    </p>
                    {registro.observacao && (
                      <p className="mt-1 text-xs text-neutral-600 italic">
                        “{registro.observacao}”
                      </p>
                    )}
                  </div>

                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 text-xs font-semibold",
                      TEXTO_SEMAFORO[registro.status]
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        PONTO_SEMAFORO[registro.status]
                      )}
                      aria-hidden
                    />
                    {semaforo.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
