import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { FormularioIndicador } from "@/components/aluno/FormularioIndicador";
import { HistoricoIndicadores } from "@/components/aluno/HistoricoIndicadores";
import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getIndicadoresAluno } from "@/lib/supabase/indicadores";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { hojeISO } from "@/lib/utils/datas";
import {
  CONFIG_INDICADORES,
  ORDEM_INDICADORES,
  type RegistroIndicador,
} from "@/lib/utils/indicadores";
import { FAIXAS_CLINICAS, SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const CORES_SEMAFORO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde-light text-saude-verde",
  amarelo: "bg-saude-amarelo-light text-saude-amarelo",
  vermelho: "bg-saude-vermelho-light text-saude-vermelho",
};

export default async function IndicadoresPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { ultimos, historico, altura } = await getIndicadoresAluno(perfil.id);

  const criticos = Object.values(ultimos).filter(
    (r) => r.status === "vermelho"
  ).length;

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      {/* ── Cabeçalho ────────────────────────────────────────────── */}
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Indicadores</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {criticos > 0
            ? "Você tem medição fora da faixa segura. Seu professor já foi avisado."
            : "Registre suas medições e acompanhe o semáforo de cada uma."}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Último de cada indicador ───────────────────────────── */}
        <section className="-mt-14 flex flex-col gap-3 md:mt-0">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase max-md:sr-only">
            Últimas medições
          </h2>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {ORDEM_INDICADORES.map((tipo) => (
              <CardUltimaMedicao
                key={tipo}
                tipo={tipo}
                registro={ultimos[tipo]}
              />
            ))}
          </div>
        </section>

        {/* ── Registro ───────────────────────────────────────────── */}
        <FormularioIndicador alunoId={perfil.id} altura={altura} />

        {/* ── Histórico ──────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Histórico
          </h2>
          <HistoricoIndicadores registros={historico} hoje={hojeISO()} />
        </section>

        {/* ── Faixas de referência ───────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Faixas de referência
          </h2>

          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                  <th scope="col" className="px-3.5 py-2.5 font-medium">
                    Indicador
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    {SEMAFORO_CONFIG.verde.emoji} Ideal
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    {SEMAFORO_CONFIG.amarelo.emoji} Atenção
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">
                    {SEMAFORO_CONFIG.vermelho.emoji} Cuidado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ORDEM_INDICADORES.map((tipo) => {
                  const faixa = FAIXAS_CLINICAS[tipo];

                  return (
                    <tr key={tipo} className="align-top">
                      <th
                        scope="row"
                        className="px-3.5 py-2.5 text-left font-semibold text-neutral-900"
                      >
                        {CONFIG_INDICADORES[tipo].labelCurto}
                      </th>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {faixa.verde}
                      </td>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {faixa.amarelo}
                      </td>
                      <td className="px-3.5 py-2.5 text-neutral-600">
                        {faixa.vermelho}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-neutral-500">
            Referências gerais do centro. Elas não substituem a orientação do
            seu médico.
          </p>
        </section>
      </div>
    </div>
  );
}

function CardUltimaMedicao({
  tipo,
  registro,
}: {
  tipo: keyof typeof CONFIG_INDICADORES;
  registro?: RegistroIndicador;
}) {
  const config = CONFIG_INDICADORES[tipo];
  const Icone = config.icone;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          config.corIcone
        )}
      >
        <Icone className="size-5" aria-hidden />
      </span>

      <p
        className={cn(
          "text-2xl leading-tight font-bold tracking-tight tabular-nums",
          registro ? "text-neutral-900" : "text-neutral-300"
        )}
      >
        {registro?.valorFormatado ?? "—"}
      </p>

      <p className="text-sm text-neutral-500">
        {config.labelCurto}
        {tipo !== "peso" && ` · ${config.unidade}`}
      </p>

      {registro ? (
        <>
          <span
            className={cn(
              "w-fit rounded-md px-2 py-0.5 text-xs font-semibold",
              CORES_SEMAFORO[registro.status]
            )}
          >
            {registro.badge || SEMAFORO_CONFIG[registro.status].label}
          </span>
          <p className="text-xs text-neutral-400">
            {formatDistanceToNow(new Date(registro.registradoEm), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </>
      ) : (
        <span className="w-fit rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-400">
          Sem registro
        </span>
      )}
    </div>
  );
}
