import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Flame, Smile } from "lucide-react";

import { RegistroHumor } from "@/components/aluno/RegistroHumor";
import type { HumorTipo } from "@/lib/types";
import { getHumorAluno } from "@/lib/supabase/humor";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { hojeISO, somarDiasISO } from "@/lib/utils/datas";
import { HUMOR_CONFIG } from "@/lib/utils/saudacao";

const DIAS = 30;

export default async function HumorPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const resumo = await getHumorAluno(perfil.id, DIAS);
  const hoje = hojeISO();

  const porData = new Map(resumo.registros.map((r) => [r.data, r]));

  // Do mais antigo para o mais recente — é como se lê um calendário.
  const janela = Array.from({ length: DIAS }, (_, i) =>
    somarDiasISO(hoje, -(DIAS - 1 - i))
  );

  const tipos = Object.keys(HUMOR_CONFIG) as HumorTipo[];
  const maisFrequente = tipos
    .filter((t) => resumo.contagem[t] > 0)
    .sort((a, b) => resumo.contagem[b] - resumo.contagem[a])[0];

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Meu humor</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {resumo.diasRegistrados === 0
            ? "Registre como você se sente. Em um mês isso vira um retrato."
            : `${resumo.diasRegistrados} ${resumo.diasRegistrados === 1 ? "dia registrado" : "dias registrados"} nos últimos ${DIAS} dias.`}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Registro de hoje ───────────────────────────────────── */}
        <div className="-mt-14 md:mt-0">
          <RegistroHumor
            alunoId={perfil.id}
            hoje={hoje}
            humorInicial={resumo.humorHoje}
          />
        </div>

        {/* ── Números do mês ─────────────────────────────────────── */}
        <section className="grid grid-cols-3 gap-3">
          <Numero
            valor={String(resumo.sequencia)}
            label={resumo.sequencia === 1 ? "dia seguido" : "dias seguidos"}
            icone={<Flame className="size-5" aria-hidden />}
            cor="bg-orange-50 text-orange-600"
          />
          <Numero
            valor={String(resumo.diasBons)}
            label="dias bons"
            icone={<Smile className="size-5" aria-hidden />}
            cor="bg-emerald-50 text-saude-verde"
          />
          <Numero
            valor={maisFrequente ? HUMOR_CONFIG[maisFrequente].emoji : "—"}
            label={
              maisFrequente ? HUMOR_CONFIG[maisFrequente].label : "sem registro"
            }
            cor="bg-blue-50 text-primary"
          />
        </section>

        {/* ── Calendário ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Últimos {DIAS} dias
          </h2>

          <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="grid grid-cols-10 gap-1.5">
              {janela.map((dia) => {
                const registro = porData.get(dia);
                const config = registro ? HUMOR_CONFIG[registro.humor] : null;
                const rotulo = format(new Date(`${dia}T12:00:00Z`), "dd/MM", {
                  locale: ptBR,
                });

                return (
                  <div
                    key={dia}
                    title={
                      config ? `${rotulo} — ${config.label}` : `${rotulo} — sem registro`
                    }
                    className="flex aspect-square items-center justify-center rounded-md text-sm"
                    style={{
                      backgroundColor: config ? `${config.cor}22` : "#F5F5F5",
                    }}
                  >
                    <span aria-hidden>{config?.emoji ?? ""}</span>
                    <span className="sr-only">
                      {config
                        ? `${rotulo}: ${config.label}`
                        : `${rotulo}: sem registro`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Distribuição ─────────────────────────────────── */}
            <ul className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
              {tipos
                .filter((t) => resumo.contagem[t] > 0)
                .sort((a, b) => resumo.contagem[b] - resumo.contagem[a])
                .map((tipo) => {
                  const quantidade = resumo.contagem[tipo];
                  const proporcao = Math.round(
                    (quantidade / Math.max(1, resumo.diasRegistrados)) * 100
                  );

                  return (
                    <li key={tipo} className="flex items-center gap-3">
                      <span className="w-6 shrink-0 text-center" aria-hidden>
                        {HUMOR_CONFIG[tipo].emoji}
                      </span>
                      <span className="w-28 shrink-0 truncate text-sm text-neutral-600">
                        {HUMOR_CONFIG[tipo].label}
                      </span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${proporcao}%`,
                            backgroundColor: HUMOR_CONFIG[tipo].cor,
                          }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-sm text-neutral-500 tabular-nums">
                        {quantidade}
                      </span>
                    </li>
                  );
                })}

              {resumo.diasRegistrados === 0 && (
                <li className="text-sm text-neutral-500">
                  Nada registrado ainda neste período.
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* ── Anotações ──────────────────────────────────────────── */}
        {resumo.registros.some((r) => r.observacao) && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Suas anotações
            </h2>

            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {resumo.registros
                .filter((r) => r.observacao)
                .map((registro) => (
                  <li key={registro.data} className="flex gap-3 p-3.5">
                    <span className="text-xl leading-none" aria-hidden>
                      {HUMOR_CONFIG[registro.humor].emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-neutral-500">
                        {format(
                          new Date(`${registro.data}T12:00:00Z`),
                          "EEEE, dd 'de' MMMM",
                          { locale: ptBR }
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-neutral-700">
                        {registro.observacao}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Numero({
  valor,
  label,
  icone,
  cor,
}: {
  valor: string;
  label: string;
  icone?: React.ReactNode;
  cor: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      {icone && (
        <span
          className={`flex size-9 items-center justify-center rounded-lg ${cor}`}
        >
          {icone}
        </span>
      )}
      <p className="text-2xl leading-tight font-bold tracking-tight text-neutral-900">
        {valor}
      </p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
