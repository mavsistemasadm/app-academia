import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { RegistroHumor } from "@/components/aluno/RegistroHumor";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
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
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Bem-estar"
        titulo="Meu humor"
        descricao={
          resumo.diasRegistrados === 0
            ? "Registre como você se sente. Em um mês isso vira um retrato."
            : `${resumo.diasRegistrados} ${resumo.diasRegistrados === 1 ? "dia registrado" : "dias registrados"} nos últimos ${DIAS} dias.`
        }
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── Registro de hoje ───────────────────────────────────── */}
        <RegistroHumor
          alunoId={perfil.id}
          hoje={hoje}
          humorInicial={resumo.humorHoje}
        />

        {/* ── Números do mês ─────────────────────────────────────── */}
        <section className="grid grid-cols-3 divide-x divide-neutral-200/80 rounded-2xl bg-card ring-1 ring-neutral-200/90">
          <Numero
            valor={String(resumo.sequencia)}
            label={resumo.sequencia === 1 ? "dia seguido" : "dias seguidos"}
          />
          <Numero valor={String(resumo.diasBons)} label="dias bons" />
          <Numero
            valor={maisFrequente ? HUMOR_CONFIG[maisFrequente].emoji : "-"}
            label={
              maisFrequente ? HUMOR_CONFIG[maisFrequente].label : "sem registro"
            }
          />
        </section>

        {/* ── Calendário ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Últimos {DIAS} dias
          </h2>

          <div className="flex flex-col gap-5 rounded-2xl bg-card p-4 ring-1 ring-neutral-200/90 md:p-5">
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 md:gap-2">
              {janela.map((dia) => {
                const registro = porData.get(dia);
                const config = registro ? HUMOR_CONFIG[registro.humor] : null;
                const rotulo = format(new Date(`${dia}T12:00:00Z`), "dd/MM", {
                  locale: ptBR,
                });
                const ehHoje = dia === hoje;

                return (
                  <div
                    key={dia}
                    title={
                      config ? `${rotulo}: ${config.label}` : `${rotulo}: sem registro`
                    }
                    className={`relative flex aspect-square items-center justify-center rounded-xl text-lg ${
                      config ? "" : "bg-neutral-50"
                    } ${ehHoje ? "ring-2 ring-grafite" : ""}`}
                    style={
                      config ? { backgroundColor: `${config.cor}1F` } : undefined
                    }
                  >
                    {config ? (
                      <span aria-hidden>{config.emoji}</span>
                    ) : (
                      <span
                        aria-hidden
                        className="numero text-[11px] font-medium text-neutral-300"
                      >
                        {dia.slice(8, 10)}
                      </span>
                    )}
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
            <div className="flex flex-col gap-3 border-t border-neutral-200/80 pt-4">
              <p className="rotulo text-neutral-400">Como foram os dias</p>

              <ul className="flex flex-col gap-3">
                {tipos
                  .filter((t) => resumo.contagem[t] > 0)
                  .sort((a, b) => resumo.contagem[b] - resumo.contagem[a])
                  .map((tipo) => {
                    const quantidade = resumo.contagem[tipo];
                    const proporcao = Math.round(
                      (quantidade / Math.max(1, resumo.diasRegistrados)) * 100
                    );

                    return (
                      <li key={tipo} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-700">
                            <span aria-hidden>{HUMOR_CONFIG[tipo].emoji}</span>
                            <span className="truncate">{HUMOR_CONFIG[tipo].label}</span>
                          </span>
                          <span className="numero shrink-0 text-[15px] font-semibold text-neutral-950">
                            {quantidade}
                            <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
                              {quantidade === 1 ? "dia" : "dias"}
                            </span>
                          </span>
                        </div>
                        <span className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${proporcao}%`,
                              backgroundColor: HUMOR_CONFIG[tipo].cor,
                            }}
                          />
                        </span>
                      </li>
                    );
                  })}

                {resumo.diasRegistrados === 0 && (
                  <li className="text-sm text-neutral-500">
                    Ainda sem registros neste período. Marque como você está
                    hoje, logo acima.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Anotações ──────────────────────────────────────────── */}
        {resumo.registros.some((r) => r.observacao) && (
          <section className="flex flex-col gap-3.5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
              Suas anotações
            </h2>

            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {resumo.registros
                .filter((r) => r.observacao)
                .map((registro) => (
                  <li key={registro.data} className="flex gap-3.5 px-5 py-4">
                    <span className="text-xl leading-none" aria-hidden>
                      {HUMOR_CONFIG[registro.humor].emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="rotulo text-neutral-400">
                        {format(
                          new Date(`${registro.data}T12:00:00Z`),
                          "EEEE, dd 'de' MMMM",
                          { locale: ptBR }
                        )}
                      </p>
                      <p className="mt-1 text-[15px] leading-relaxed text-neutral-700">
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

function Numero({ valor, label }: { valor: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-3 py-4 md:px-5">
      <p className="numero text-[28px] leading-none font-semibold text-neutral-950">
        {valor}
      </p>
      <p className="truncate text-[13px] text-neutral-500">{label}</p>
    </div>
  );
}
