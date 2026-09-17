import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, Trophy, Users } from "lucide-react";

import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { cn } from "@/lib/utils";
import { getDesafiosDoAluno } from "@/lib/supabase/desafios";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { hojeISO } from "@/lib/utils/datas";
import { diasEntre, ROTULO_SITUACAO } from "@/lib/utils/desafios";

const CHIP = "rounded-full px-2.5 py-0.5 text-[11px] font-semibold";

function dataCurta(iso: string) {
  return format(new Date(`${iso}T12:00:00Z`), "d 'de' MMM", { locale: ptBR });
}

export default async function DesafiosPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { desafios, indisponivel } = await getDesafiosDoAluno(perfil.id);
  const hoje = hojeISO();

  const meus = desafios.filter((d) => d.minhaSituacao === "participando" || d.minhaSituacao === "convidado");
  const outros = desafios.filter(
    (d) => !meus.includes(d) && d.desafio.aberto && d.situacao !== "encerrado"
  );

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Turma"
        titulo="Desafios"
        descricao="Aparecer, medir, beber água e tomar o remédio na hora valem ponto. O resto é com você."
      />

      <div className="flex flex-col gap-8 px-5 md:px-0">
        {indisponivel && (
          <p className="rounded-2xl bg-card px-5 py-5 text-[15px] leading-relaxed text-neutral-500 ring-1 ring-neutral-200/90">
            Os desafios estão sendo ativados. Volte daqui a pouco.
          </p>
        )}

        {!indisponivel && desafios.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
            <Trophy className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
            <p className="text-[15px] font-semibold text-neutral-950">Nenhum desafio por enquanto</p>
            <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
              Quando o centro criar um, ele aparece aqui e você decide se entra.
            </p>
          </div>
        )}

        {[
          { titulo: "Seus desafios", itens: meus },
          { titulo: "Abertos para entrar", itens: outros },
        ]
          .filter(({ itens }) => itens.length > 0)
          .map(({ titulo, itens }) => (
            <section key={titulo} className="flex flex-col gap-3.5">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
                {titulo}
              </h2>

              <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
                {itens.map(({ desafio, situacao, minhaSituacao, participantes, meusPontos, minhaPosicao }) => {
                  const faltam =
                    situacao === "em_andamento"
                      ? diasEntre(hoje, desafio.fim)
                      : situacao === "agendado"
                        ? diasEntre(hoje, desafio.inicio)
                        : 0;

                  return (
                    <li key={desafio.id}>
                      <Link
                        href={`/desafios/${desafio.id}`}
                        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-neutral-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-[15px] font-semibold text-neutral-950">{desafio.nome}</p>
                            {minhaSituacao === "convidado" && (
                              <span className={cn(CHIP, "bg-saude-amarelo-light text-[#b45309]")}>
                                Convite
                              </span>
                            )}
                            {situacao === "encerrado" && (
                              <span className={cn(CHIP, "bg-neutral-100 text-neutral-500")}>
                                {ROTULO_SITUACAO.encerrado}
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-[13px] text-neutral-500">
                            {dataCurta(desafio.inicio)} a {dataCurta(desafio.fim)}
                            {situacao === "em_andamento" && faltam >= 0 && (
                              <> · {faltam === 0 ? "último dia" : `faltam ${faltam} dias`}</>
                            )}
                            {situacao === "agendado" && <> · começa em {faltam} dias</>}
                          </p>

                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-500">
                            <span className="flex items-center gap-1.5">
                              <Users className="size-3.5 text-neutral-400" strokeWidth={1.8} aria-hidden />
                              <span className="numero font-semibold text-neutral-950">{participantes}</span>
                              {participantes === 1 ? "participante" : "participantes"}
                            </span>
                            {minhaSituacao === "participando" && meusPontos !== null && (
                              <span className="flex items-center gap-1.5">
                                <Trophy className="size-3.5 text-neutral-400" strokeWidth={1.8} aria-hidden />
                                <span className="numero font-semibold text-neutral-950">{meusPontos}</span>
                                pontos
                                {minhaPosicao !== null && <> · {minhaPosicao}º lugar</>}
                              </span>
                            )}
                          </p>
                        </div>

                        <ChevronRight className="size-5 shrink-0 text-neutral-300" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
