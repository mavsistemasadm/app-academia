import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, UserRound } from "lucide-react";

import { AceitarConvite } from "@/components/aluno/AceitarConvite";
import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getVisaoFamiliar } from "@/lib/supabase/familiares";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { hojeISO, somarDiasISO } from "@/lib/utils/datas";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";
import { SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const CORES_SEMAFORO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde-light text-saude-verde",
  amarelo: "bg-saude-amarelo-light text-saude-amarelo",
  vermelho: "bg-saude-vermelho-light text-saude-vermelho",
};

const DIAS_NO_CALENDARIO = 30;

export default async function AcompanharPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const acompanhados = await getVisaoFamiliar(perfil.id);
  const hoje = hojeISO();

  const janela = Array.from({ length: DIAS_NO_CALENDARIO }, (_, i) =>
    somarDiasISO(hoje, -(DIAS_NO_CALENDARIO - 1 - i))
  );

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Acompanhar</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {acompanhados.length === 0
            ? "Use o código que seu familiar gerou no app dele."
            : "Indicadores e frequência de quem você acompanha."}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <div className="-mt-14 md:mt-0">
          <AceitarConvite familiarId={perfil.id} />
        </div>

        {acompanhados.map((pessoa) => {
          const presentes = new Set(pessoa.diasPresentes);

          return (
            <section
              key={pessoa.aluno.id}
              className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-base font-semibold text-neutral-500">
                  {pessoa.aluno.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pessoa.aluno.foto_url}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    pessoa.aluno.nome.charAt(0).toUpperCase() || (
                      <UserRound className="size-5" aria-hidden />
                    )
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold text-neutral-900">
                    {pessoa.aluno.nome}
                  </h2>
                  <p className="text-sm text-neutral-500">
                    {pessoa.parentesco ?? "Familiar"} ·{" "}
                    {pessoa.ultimaPresenca
                      ? `esteve na academia ${formatDistanceToNow(
                          new Date(`${pessoa.ultimaPresenca}T12:00:00Z`),
                          { addSuffix: true, locale: ptBR }
                        )}`
                      : "sem presença registrada"}
                  </p>
                </div>
              </div>

              {/* ── Indicadores ────────────────────────────────── */}
              {pessoa.indicadores.length === 0 ? (
                <p className="rounded-xl bg-neutral-50 px-3.5 py-3 text-sm text-neutral-500">
                  Nenhuma medição registrada ainda.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {pessoa.indicadores.map((registro) => {
                    const config =
                      CONFIG_INDICADORES[
                        registro.tipo as keyof typeof CONFIG_INDICADORES
                      ];

                    return (
                      <li
                        key={registro.id}
                        className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 p-3"
                      >
                        <p className="text-lg leading-tight font-bold text-neutral-900 tabular-nums">
                          {registro.valorFormatado}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {config.labelCurto}
                        </p>
                        <span
                          className={cn(
                            "w-fit rounded-md px-2 py-0.5 text-xs font-semibold",
                            CORES_SEMAFORO[registro.status]
                          )}
                        >
                          {SEMAFORO_CONFIG[registro.status].label}
                        </span>
                        <p className="text-xs text-neutral-400">
                          {formatDistanceToNow(
                            new Date(registro.registradoEm),
                            { addSuffix: true, locale: ptBR }
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* ── Frequência ─────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <CalendarCheck className="size-4 shrink-0" aria-hidden />
                  {pessoa.frequenciaNoMes}{" "}
                  {pessoa.frequenciaNoMes === 1 ? "presença" : "presenças"} neste
                  mês
                </p>

                <div className="grid grid-cols-10 gap-1.5">
                  {janela.map((dia) => {
                    const veio = presentes.has(dia);
                    const rotulo = format(new Date(`${dia}T12:00:00Z`), "dd/MM");

                    return (
                      <div
                        key={dia}
                        title={`${rotulo} — ${veio ? "esteve na academia" : "não veio"}`}
                        className={cn(
                          "aspect-square rounded-md",
                          veio ? "bg-saude-verde" : "bg-neutral-100"
                        )}
                      >
                        <span className="sr-only">
                          {rotulo}: {veio ? "presente" : "ausente"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}

        {acompanhados.length > 0 && (
          <p className="text-xs text-neutral-500">
            Você vê apenas indicadores e frequência. Treino, humor, conversas e
            anamnese ficam entre o aluno e o centro.
          </p>
        )}
      </div>
    </div>
  );
}
