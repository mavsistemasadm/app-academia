import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Flame } from "lucide-react";

import { RegistroHidratacao } from "@/components/aluno/RegistroHidratacao";
import { getHidratacaoAluno } from "@/lib/supabase/hidratacao";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { precisaAcessibilidadeAmpliada } from "@/lib/utils/avatares";

export default async function HidratacaoPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const dados = await getHidratacaoAluno(perfil.id, perfil.meta_agua_ml);

  const prioritario =
    precisaAcessibilidadeAmpliada(perfil.avatar_condicao) ||
    Boolean(
      perfil.avatar_condicao?.some(
        (c) => c === "diabetico" || c === "gestante"
      )
    );

  const maximo = Math.max(dados.metaMl, ...dados.ultimosDias.map((d) => d.ml));

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Hidratação</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {prioritario
            ? "Pela sua condição, beber água ao longo do dia é parte do tratamento."
            : "Um toque a cada copo. O resto o app soma para você."}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <div className="-mt-14 md:mt-0">
          <RegistroHidratacao
            alunoId={perfil.id}
            hoje={dados.hoje}
            metaMl={dados.metaMl}
            hojeMl={dados.hojeMl}
            registros={dados.registrosDeHoje}
          />
        </div>

        {dados.sequencia > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Flame className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-bold text-neutral-900">
                {dados.sequencia}{" "}
                {dados.sequencia === 1 ? "dia seguido" : "dias seguidos"} na meta
              </p>
              <p className="text-sm text-neutral-500">
                Continue assim — hidratação constante vale mais que um dia de
                exagero.
              </p>
            </div>
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Últimos 14 dias
          </h2>

          <ul className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-white p-4">
            {dados.ultimosDias
              .slice()
              .reverse()
              .map(({ data, ml }) => {
                const bateu = ml >= dados.metaMl;

                return (
                  <li key={data} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-neutral-500">
                      {format(new Date(`${data}T12:00:00Z`), "EEE, dd/MM", {
                        locale: ptBR,
                      })}
                    </span>
                    <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <span
                        className={`block h-full rounded-full ${
                          bateu ? "bg-saude-verde" : "bg-primary"
                        }`}
                        style={{
                          width: `${Math.round((ml / maximo) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right text-sm text-neutral-600 tabular-nums">
                      {(ml / 1000).toFixed(1).replace(".", ",")} L
                    </span>
                  </li>
                );
              })}
          </ul>

          <p className="text-xs text-neutral-500">
            Sua meta é de {(dados.metaMl / 1000).toFixed(1).replace(".", ",")} L
            por dia. Dá para ajustar com o professor.
          </p>
        </section>
      </div>
    </div>
  );
}
