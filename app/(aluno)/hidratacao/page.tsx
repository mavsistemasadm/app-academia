import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { RegistroHidratacao } from "@/components/aluno/RegistroHidratacao";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
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
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Cuidado diário"
        titulo="Hidratação"
        descricao={
          prioritario
            ? "Pela sua condição, beber água ao longo do dia é parte do tratamento."
            : "Um toque a cada copo. O resto o app soma para você."
        }
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <RegistroHidratacao
          alunoId={perfil.id}
          hoje={dados.hoje}
          metaMl={dados.metaMl}
          hojeMl={dados.hojeMl}
          registros={dados.registrosDeHoje}
        />

        {dados.sequencia > 0 && (
          <div className="flex items-center gap-4 rounded-2xl bg-card px-5 py-4 ring-1 ring-neutral-200/90">
            <p className="numero text-[28px] leading-none font-semibold text-neutral-950">
              {dados.sequencia}
            </p>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-neutral-950">
                {dados.sequencia === 1 ? "dia seguido" : "dias seguidos"} na meta
              </p>
              <p className="text-sm text-neutral-500">
                Hidratação constante vale mais que um dia de exagero.
              </p>
            </div>
          </div>
        )}

        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Últimos 14 dias
          </h2>

          <ul className="flex flex-col gap-2.5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90">
            {dados.ultimosDias
              .slice()
              .reverse()
              .map(({ data, ml }) => {
                const bateu = ml >= dados.metaMl;

                return (
                  <li key={data} className="flex items-center gap-3">
                    <span className="rotulo w-[5.5rem] shrink-0 text-neutral-400">
                      {format(new Date(`${data}T12:00:00Z`), "EEE dd/MM", {
                        locale: ptBR,
                      })}
                    </span>
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <span
                        className={`block h-full rounded-full ${
                          bateu ? "bg-ciano" : "bg-neutral-300"
                        }`}
                        style={{
                          width: `${Math.round((ml / maximo) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="numero w-12 shrink-0 text-right text-sm font-medium text-neutral-600">
                      {(ml / 1000).toFixed(1).replace(".", ",")}
                      <span className="ml-0.5 font-sans text-[11px] tracking-normal text-neutral-400">
                        L
                      </span>
                    </span>
                  </li>
                );
              })}
          </ul>

          <p className="text-[13px] text-neutral-500">
            Sua meta é de {(dados.metaMl / 1000).toFixed(1).replace(".", ",")} L
            por dia. Em ciano, os dias em que você chegou lá. Dá para ajustar a
            meta com o professor.
          </p>
        </section>
      </div>
    </div>
  );
}
