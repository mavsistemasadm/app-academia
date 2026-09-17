import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Trophy } from "lucide-react";

import { BotaoParticiparDesafio } from "@/components/aluno/BotaoParticiparDesafio";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { cn } from "@/lib/utils";
import { getDesafio, getDetalhePontos, getRanking } from "@/lib/supabase/desafios";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/utils/datas";
import { diasEntre, HABITOS, ROTULO_SITUACAO, situacaoDoDesafio } from "@/lib/utils/desafios";

function dataLonga(iso: string) {
  return format(new Date(`${iso}T12:00:00Z`), "d 'de' MMMM", { locale: ptBR });
}

export default async function DesafioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { id } = await params;
  const desafio = await getDesafio(id);
  if (!desafio || desafio.cancelado) notFound();

  const supabase = await createClient();

  const [{ data: minha }, ranking, detalhe] = await Promise.all([
    supabase
      .from("desafio_participantes")
      .select("status")
      .eq("desafio_id", id)
      .eq("aluno_id", perfil.id)
      .maybeSingle(),
    getRanking(supabase, id),
    getDetalhePontos(supabase, id),
  ]);

  const status = (minha?.status as string | undefined) ?? null;
  const minhaSituacao =
    status === "ativo"
      ? "participando"
      : status === "convidado"
        ? "convidado"
        : status === "saiu"
          ? "saiu"
          : "fora";

  const hoje = hojeISO();
  const situacao = situacaoDoDesafio(desafio.inicio, desafio.fim, hoje);
  const faltam = diasEntre(hoje, desafio.fim);
  const eu = ranking.find((l) => l.souEu);
  const minhaPosicao = ranking.findIndex((l) => l.souEu) + 1;
  const podeEntrar = desafio.aberto || minhaSituacao === "convidado";

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <div className="px-5 md:px-0">
        <Link
          href="/desafios"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Desafios
        </Link>
      </div>

      <CabecalhoPagina
        rotulo={ROTULO_SITUACAO[situacao]}
        titulo={desafio.nome}
        descricao={
          <>
            {dataLonga(desafio.inicio)} a {dataLonga(desafio.fim)}
            {situacao === "em_andamento" && (
              <> · {faltam === 0 ? "hoje é o último dia" : `faltam ${faltam} dias`}</>
            )}
            {desafio.descricao && (
              <>
                <br />
                {desafio.descricao}
              </>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-8 px-5 md:px-0">
        {minhaSituacao !== "participando" && podeEntrar && (
          <BotaoParticiparDesafio
            desafioId={desafio.id}
            alunoId={perfil.id}
            minhaSituacao={minhaSituacao}
            encerrado={situacao === "encerrado"}
          />
        )}

        {minhaSituacao === "participando" && (
          <section className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-4 rounded-[26px] bg-grafite p-6 text-white">
              <p className="rotulo text-white/50">Seus pontos</p>
              <div className="flex items-end justify-between gap-4">
                <p className="numero text-[44px] leading-none font-semibold">
                  {eu?.pontos ?? 0}
                  <span className="ml-2 font-sans text-sm font-medium tracking-normal text-white/50">
                    pontos
                  </span>
                </p>
                {minhaPosicao > 0 && (
                  <p className="numero text-right text-[28px] leading-none font-semibold text-ciano">
                    {minhaPosicao}º
                    <span className="ml-1 font-sans text-xs font-medium tracking-normal text-white/50">
                      de {ranking.length}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {HABITOS.filter(({ chave }) => desafio.regras[chave] > 0).map(
                ({ chave, titulo, descricao, icone: Icone }) => {
                  const linha = detalhe.find((d) => d.habito === chave);

                  return (
                    <li key={chave} className="flex items-center gap-3.5 px-5 py-3.5">
                      <Icone className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold text-neutral-950">{titulo}</p>
                        <p className="text-[13px] text-neutral-500">
                          {descricao} · {desafio.regras[chave]} pontos por dia
                        </p>
                      </div>
                      <p className="numero shrink-0 text-right text-[15px] font-semibold text-neutral-950">
                        {linha?.pontos ?? 0}
                        <span className="block font-sans text-[11px] font-medium tracking-normal text-neutral-400">
                          {linha?.dias ?? 0} {linha?.dias === 1 ? "dia" : "dias"}
                        </span>
                      </p>
                    </li>
                  );
                }
              )}
            </ul>

            <BotaoParticiparDesafio
              desafioId={desafio.id}
              alunoId={perfil.id}
              minhaSituacao={minhaSituacao}
              encerrado={situacao === "encerrado"}
            />
          </section>
        )}

        <section className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
              Ranking
            </h2>
            <p className="rotulo text-neutral-400">
              {ranking.length} {ranking.length === 1 ? "participante" : "participantes"}
            </p>
          </div>

          {ranking.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
              <Trophy className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
              <p className="text-[15px] font-semibold text-neutral-950">Ninguém entrou ainda</p>
              <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
                Seja o primeiro. Quem entra agora começa com a mesma pontuação de todo mundo.
              </p>
            </div>
          ) : (
            <ol className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {ranking.map((linha, i) => (
                <li
                  key={linha.alunoId}
                  className={cn(
                    "flex items-center gap-3.5 px-4 py-3 md:px-5",
                    linha.souEu && "bg-neutral-50"
                  )}
                >
                  <span
                    className={cn(
                      "numero flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      i === 0
                        ? "bg-grafite text-white"
                        : "bg-neutral-100 text-neutral-500"
                    )}
                  >
                    {i + 1}
                  </span>

                  <span className="numero flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-semibold text-neutral-500">
                    {linha.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={linha.fotoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      linha.nome.charAt(0).toUpperCase()
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-neutral-950">
                      {linha.nome}
                      {linha.souEu && <span className="font-normal text-neutral-500"> · você</span>}
                    </p>
                    <p className="rotulo text-neutral-400">
                      {linha.diasAtivos} {linha.diasAtivos === 1 ? "dia ativo" : "dias ativos"}
                    </p>
                  </div>

                  <p className="numero shrink-0 text-[17px] font-semibold text-neutral-950">
                    {linha.pontos}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <p className="text-[13px] leading-relaxed text-neutral-500">
            O ranking mostra só o primeiro nome, a inicial do sobrenome e os pontos. Nenhum dado de
            saúde aparece aqui.
          </p>
        </section>
      </div>
    </div>
  );
}
