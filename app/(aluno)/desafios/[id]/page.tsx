import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Check, FileText, Trophy } from "lucide-react";

import { BotaoParticiparDesafio } from "@/components/aluno/BotaoParticiparDesafio";
import { RegistroDesafio } from "@/components/aluno/RegistroDesafio";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { cn } from "@/lib/utils";
import {
  getDesafio,
  getDetalhePontos,
  getMeusRegistros,
  getProgresso,
  getRanking,
} from "@/lib/supabase/desafios";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/utils/datas";
import {
  diasEntre,
  formatarQuantidade,
  HABITOS,
  METRICAS,
  porcentagem,
  ROTULO_SITUACAO,
  situacaoDoDesafio,
} from "@/lib/utils/desafios";

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

  const meta = desafio.tipo === "meta" && desafio.metrica && desafio.objetivo !== null;

  const [{ data: minha }, ranking, detalhe, progresso, registros] = await Promise.all([
    supabase
      .from("desafio_participantes")
      .select("status")
      .eq("desafio_id", id)
      .eq("aluno_id", perfil.id)
      .maybeSingle(),
    meta ? Promise.resolve([]) : getRanking(supabase, id),
    meta ? Promise.resolve([]) : getDetalhePontos(supabase, id),
    meta ? getProgresso(supabase, id) : Promise.resolve([]),
    meta && desafio.metrica && METRICAS[desafio.metrica].manual
      ? getMeusRegistros(supabase, id, perfil.id)
      : Promise.resolve([]),
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
  const classificacao = meta
    ? progresso.map((l) => ({
        alunoId: l.alunoId,
        nome: l.nome,
        fotoUrl: l.fotoUrl,
        valor: l.quantidade,
        detalhe: l.concluido ? "concluiu a meta" : null,
        souEu: l.souEu,
      }))
    : ranking.map((l) => ({
        alunoId: l.alunoId,
        nome: l.nome,
        fotoUrl: l.fotoUrl,
        valor: l.pontos,
        detalhe: `${l.diasAtivos} ${l.diasAtivos === 1 ? "dia ativo" : "dias ativos"}`,
        souEu: l.souEu,
      }));

  const eu = classificacao.find((l) => l.souEu);
  const minhaPosicao = classificacao.findIndex((l) => l.souEu) + 1;
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
        {desafio.imagemUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={desafio.imagemUrl}
            alt=""
            className="h-40 w-full rounded-2xl object-cover md:h-52"
          />
        )}

        {meta && desafio.metrica && desafio.objetivo !== null && (
          <p className="text-[15px] leading-relaxed text-neutral-600">
            Meta de cada participante:{" "}
            <strong className="font-semibold text-neutral-950">
              {formatarQuantidade(desafio.objetivo, desafio.metrica)}
            </strong>{" "}
            até o fim. {METRICAS[desafio.metrica].comoConta}
          </p>
        )}

        {desafio.arquivoUrl && (
          <a
            href={desafio.arquivoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-2 rounded-full bg-card px-4 py-3 text-sm font-semibold text-neutral-950 ring-1 ring-neutral-200/90 transition-colors hover:bg-neutral-50"
          >
            <FileText className="size-4 text-neutral-400" strokeWidth={1.8} aria-hidden />
            {desafio.arquivoNome ?? "Abrir arquivo do desafio"}
          </a>
        )}
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
              <p className="rotulo text-white/50">
                {meta ? "Seu progresso" : "Seus pontos"}
              </p>
              <div className="flex items-end justify-between gap-4">
                <p className="numero text-[44px] leading-none font-semibold">
                  {meta && desafio.metrica
                    ? formatarQuantidade(eu?.valor ?? 0, desafio.metrica).split(" ")[0]
                    : (eu?.valor ?? 0)}
                  <span className="ml-2 font-sans text-sm font-medium tracking-normal text-white/50">
                    {meta && desafio.metrica
                      ? `de ${formatarQuantidade(desafio.objetivo ?? 0, desafio.metrica)}`
                      : "pontos"}
                  </span>
                </p>
                {minhaPosicao > 0 && (
                  <p className="numero text-right text-[28px] leading-none font-semibold text-ciano">
                    {minhaPosicao}º
                    <span className="ml-1 font-sans text-xs font-medium tracking-normal text-white/50">
                      de {classificacao.length}
                    </span>
                  </p>
                )}
              </div>

              {meta && desafio.objetivo !== null && (
                <>
                  <div aria-hidden className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-ciano transition-all duration-200"
                      style={{ width: `${porcentagem(eu?.valor ?? 0, desafio.objetivo)}%` }}
                    />
                  </div>
                  <p className="text-sm text-white/60">
                    {porcentagem(eu?.valor ?? 0, desafio.objetivo) >= 100
                      ? "Meta batida. Continue somando se quiser."
                      : `${porcentagem(eu?.valor ?? 0, desafio.objetivo)}% da meta`}
                  </p>
                </>
              )}
            </div>

            {meta && desafio.metrica && METRICAS[desafio.metrica].manual && (
              <RegistroDesafio
                desafioId={desafio.id}
                alunoId={perfil.id}
                metrica={desafio.metrica}
                hoje={hoje}
                registros={registros}
                bloqueado={situacao !== "em_andamento"}
              />
            )}

            <ul className={cn(
              "flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90",
              meta ? "hidden" : "flex"
            )}>
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
              {classificacao.length} {classificacao.length === 1 ? "participante" : "participantes"}
            </p>
          </div>

          {classificacao.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
              <Trophy className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
              <p className="text-[15px] font-semibold text-neutral-950">Ninguém entrou ainda</p>
              <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
                Seja o primeiro. Quem entra agora começa com a mesma pontuação de todo mundo.
              </p>
            </div>
          ) : (
            <ol className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {classificacao.map((linha, i) => (
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
                    {linha.detalhe && (
                      <p className="rotulo flex items-center gap-1 text-neutral-400">
                        {linha.detalhe === "concluiu a meta" && (
                          <Check className="size-3.5 text-saude-verde" strokeWidth={2.4} aria-hidden />
                        )}
                        {linha.detalhe}
                      </p>
                    )}
                  </div>

                  <p className="numero shrink-0 text-[17px] font-semibold text-neutral-950">
                    {meta && desafio.metrica
                      ? formatarQuantidade(linha.valor, desafio.metrica)
                      : linha.valor}
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
