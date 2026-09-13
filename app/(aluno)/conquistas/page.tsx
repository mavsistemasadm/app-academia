import { redirect } from "next/navigation";
import {
  Activity,
  Award,
  CalendarCheck,
  Droplet,
  Dumbbell,
  HeartPulse,
  Medal,
  Pill,
  Smile,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getConquistasAluno, type Conquista } from "@/lib/supabase/conquistas";
import { META_PADRAO_ML } from "@/lib/supabase/hidratacao";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { cn } from "@/lib/utils";

/** Ícone de cada selo. O emoji continua nos dados; na tela o selo fala em traço. */
const ICONE_CONQUISTA: Record<string, LucideIcon> = {
  primeiro_passo: Sprout,
  semana_completa: CalendarCheck,
  mes_sem_faltar: Medal,
  vinte_treinos: Dumbbell,
  indicadores_no_verde: HeartPulse,
  quem_mede_cuida: Activity,
  remedio_em_dia: Pill,
  humor_registrado: Smile,
  bem_hidratado: Droplet,
};

/** Contorno de selo: roseta de 18 pontas, recortada em SVG. */
const ROSETA = (() => {
  const pontas = 18;
  const pontos: string[] = [];
  for (let i = 0; i < pontas * 2; i += 1) {
    const raio = i % 2 === 0 ? 39 : 35.5;
    const angulo = (Math.PI * i) / pontas - Math.PI / 2;
    pontos.push(`${(40 + raio * Math.cos(angulo)).toFixed(2)},${(40 + raio * Math.sin(angulo)).toFixed(2)}`);
  }
  return pontos.join(" ");
})();

function Selo({ conquista }: { conquista: Conquista }) {
  const Icone = ICONE_CONQUISTA[conquista.chave] ?? Award;
  const raioAnel = 27;
  const circunferencia = 2 * Math.PI * raioAnel;

  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 80 80" className="size-20" aria-hidden>
        <polygon
          points={ROSETA}
          className={
            conquista.conquistada
              ? "fill-grafite"
              : "fill-neutral-100 stroke-neutral-300"
          }
          strokeWidth={conquista.conquistada ? 0 : 1}
          strokeLinejoin="round"
        />
        {conquista.conquistada ? (
          <circle cx="40" cy="40" r={raioAnel} fill="none" stroke="var(--ciano)" strokeOpacity=".35" strokeWidth="1.2" />
        ) : (
          <>
            <circle cx="40" cy="40" r={raioAnel} fill="none" stroke="var(--color-neutral-200)" strokeWidth="3" />
            <circle
              cx="40"
              cy="40"
              r={raioAnel}
              fill="none"
              stroke="var(--ciano)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circunferencia}
              strokeDashoffset={circunferencia * (1 - conquista.progresso / 100)}
              transform="rotate(-90 40 40)"
            />
          </>
        )}
      </svg>
      <Icone
        className={cn(
          "absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2",
          conquista.conquistada ? "text-ciano" : "text-neutral-400"
        )}
        strokeWidth={1.8}
        aria-hidden
      />
    </div>
  );
}

export default async function ConquistasPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { conquistas, totalConquistadas, sequenciaAtual } =
    await getConquistasAluno(
      perfil.id,
      perfil.meta_agua_ml && perfil.meta_agua_ml > 0
        ? perfil.meta_agua_ml
        : META_PADRAO_ML
    );

  const conquistadas = conquistas.filter((c) => c.conquistada);
  const emAndamento = conquistas
    .filter((c) => !c.conquistada)
    .sort((a, b) => b.progresso - a.progresso);

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Constância"
        titulo="Conquistas"
        descricao={
          totalConquistadas === 0
            ? "Nenhuma ainda. A primeira vem no seu primeiro registro."
            : `${totalConquistadas} de ${conquistas.length} conquistadas.`
        }
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Sequência ─────────────────────────────────────────── */}
        <section className="grid grid-cols-[1fr_auto] items-end gap-4 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6">
          <div className="min-w-0">
            <p className="rotulo text-neutral-400">Sequência de presença</p>
            {sequenciaAtual > 0 ? (
              <>
                <p className="mt-3 flex items-baseline">
                  <span className="numero text-[56px] leading-none font-semibold text-neutral-950">
                    {sequenciaAtual}
                  </span>
                  <span className="ml-2 text-sm font-medium text-neutral-400">
                    {sequenciaAtual === 1 ? "dia seguido" : "dias seguidos"}
                  </span>
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
                  Dias seguidos com check-in na academia.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-neutral-950">
                  Sua sequência começa no próximo check-in
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
                  Cada dia de presença seguido soma aqui.
                </p>
              </>
            )}
          </div>

          <div className="text-right">
            <p className="numero text-[28px] leading-none font-semibold text-neutral-950">
              {totalConquistadas}
              <span className="ml-0.5 font-sans text-sm font-medium tracking-normal text-neutral-400">
                /{conquistas.length}
              </span>
            </p>
            <p className="rotulo mt-1.5 text-neutral-400">Selos</p>
          </div>
        </section>

        {/* ── Conquistadas ──────────────────────────────────────── */}
        {conquistadas.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
              Seus selos
            </h2>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {conquistadas.map((conquista) => (
                <li
                  key={conquista.chave}
                  className="relative flex flex-col items-center gap-3 rounded-2xl bg-card px-3 pt-5 pb-4 text-center ring-1 ring-neutral-200/90"
                >
                  {conquista.nova && (
                    <span className="absolute top-3 right-3 rounded-full bg-ciano px-2.5 py-0.5 text-[11px] font-semibold text-grafite">
                      Novo
                    </span>
                  )}
                  <Selo conquista={conquista} />
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug font-semibold tracking-[-0.01em] text-neutral-950">
                      {conquista.titulo}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-neutral-500">
                      {conquista.descricao}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── A caminho ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            A caminho
          </h2>

          {emAndamento.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
              <Medal className="size-7 text-ciano" strokeWidth={1.8} aria-hidden />
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-neutral-950">
                Você conquistou todas
              </p>
              <p className="max-w-xs text-[15px] leading-relaxed text-neutral-500">
                Isso é constância de verdade. Seu professor está vendo.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {emAndamento.map((conquista) => (
                <li key={conquista.chave} className="flex items-center gap-4 px-4 py-4 md:px-5">
                  <Selo conquista={conquista} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-neutral-950">
                      {conquista.titulo}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug text-neutral-500">
                      {conquista.descricao}
                    </p>
                    <p className="rotulo mt-2 text-neutral-400">
                      {conquista.detalhe}
                      <span className="ml-2 text-primary">{conquista.progresso}%</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
