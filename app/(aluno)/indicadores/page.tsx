import { redirect } from "next/navigation";

import { CardIndicador } from "@/components/aluno/CardIndicador";
import { FormularioIndicador } from "@/components/aluno/FormularioIndicador";
import { HistoricoIndicadores } from "@/components/aluno/HistoricoIndicadores";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import type { IndicadorTipo, SemaforoStatus } from "@/lib/types";
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

const PONTO_SEMAFORO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde",
  amarelo: "bg-saude-amarelo",
  vermelho: "bg-saude-vermelho",
};

export default async function IndicadoresPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { ultimos, historico, altura } = await getIndicadoresAluno(perfil.id);

  const criticos = Object.values(ultimos).filter(
    (r) => r.status === "vermelho"
  ).length;

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Saúde"
        titulo="Indicadores"
        descricao={
          criticos > 0
            ? "Você tem medição fora da faixa segura. Seu professor já foi avisado."
            : "Registre suas medições e veja onde cada uma cai na faixa saudável."
        }
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Último de cada indicador ───────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Últimas medições
          </h2>

          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
            {ORDEM_INDICADORES.map((tipo) => (
              <UltimaMedicao key={tipo} tipo={tipo} registro={ultimos[tipo]} />
            ))}
          </div>
        </section>

        {/* ── Registro ───────────────────────────────────────────── */}
        <section id="registrar" className="scroll-mt-6">
          <FormularioIndicador alunoId={perfil.id} altura={altura} />
        </section>

        {/* ── Histórico ──────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Histórico
          </h2>
          <HistoricoIndicadores registros={historico} hoje={hojeISO()} />
        </section>

        {/* ── Faixas de referência ───────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Faixas de referência
          </h2>

          <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
            {ORDEM_INDICADORES.map((tipo) => {
              const faixa = FAIXAS_CLINICAS[tipo];
              const trechos: { status: SemaforoStatus; texto: string }[] = [
                { status: "verde", texto: faixa.verde },
                { status: "amarelo", texto: faixa.amarelo },
                { status: "vermelho", texto: faixa.vermelho },
              ];

              return (
                <li
                  key={tipo}
                  className="flex flex-col gap-2 px-4 py-3.5 md:flex-row md:items-center md:gap-6 md:px-5"
                >
                  <p className="text-[15px] font-semibold text-neutral-950 md:w-32 md:shrink-0">
                    {CONFIG_INDICADORES[tipo].labelCurto}
                  </p>
                  <dl className="grid flex-1 gap-1.5 sm:grid-cols-3 sm:gap-4">
                    {trechos.map(({ status, texto }) => (
                      <div key={status} className="flex items-center gap-2 text-sm">
                        <span
                          aria-hidden
                          className={cn("size-2 shrink-0 rounded-full", PONTO_SEMAFORO[status])}
                        />
                        <dt className="sr-only">{SEMAFORO_CONFIG[status].label}</dt>
                        <dd className="text-neutral-600 tabular-nums">{texto}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>

          <p className="text-[13px] text-neutral-500">
            Referências gerais do centro. Elas não substituem a orientação do
            seu médico.
          </p>
        </section>
      </div>
    </div>
  );
}

function UltimaMedicao({
  tipo,
  registro,
}: {
  tipo: IndicadorTipo;
  registro?: RegistroIndicador;
}) {
  const config = CONFIG_INDICADORES[tipo];

  const faixa = !registro
    ? undefined
    : tipo === "peso"
      ? registro.imc
        ? { tipo, valor: registro.imc }
        : undefined
      : {
          tipo,
          valor: registro.valorPrincipal,
          valorSecundario: registro.valorSecundario,
        };

  return (
    <CardIndicador
      icone={config.icone}
      label={config.labelCurto}
      // O `valorFormatado` do peso já traz o "kg" — a unidade vai à parte.
      valor={registro ? registro.valorFormatado.replace(" kg", "") : ""}
      unidade={config.unidade}
      status={registro?.status}
      badge={registro?.badge || undefined}
      href="#registrar"
      faixa={faixa}
    />
  );
}
