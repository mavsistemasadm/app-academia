import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  MessageCircle,
  Phone,
  Stethoscope,
  Timer,
  UserRound,
} from "lucide-react";

import { CardIndicador, CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
import { cn } from "@/lib/utils";
import { getDetalheAluno } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getTreinosRecentes } from "@/lib/supabase/professor";
import { AVATAR_CONFIG } from "@/lib/utils/avatares";
import { formatarDuracao } from "@/lib/utils/duracao";
import { hojeISO, horaAtual } from "@/lib/utils/datas";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";
import { HUMOR_CONFIG } from "@/lib/utils/saudacao";
import { calcularSemaforo } from "@/lib/utils/semaforo";

function telefoneBonito(digitos?: string) {
  if (!digitos) return null;
  const d = digitos.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

const CARD = "rounded-2xl bg-card ring-1 ring-neutral-200/90";

function TituloSecao({
  children,
  acao,
}: {
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
        {children}
      </h2>
      {acao}
    </div>
  );
}

function LinkSecao({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
      {children}
      <ArrowRight
        className="size-3.5 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

function Vazio({ icone: Icone, children }: { icone: typeof ClipboardList; children: React.ReactNode }) {
  return (
    <div className={cn(CARD, "flex items-start gap-3 px-5 py-5")}>
      <Icone className="mt-0.5 size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
      <p className="text-sm leading-relaxed text-neutral-500">{children}</p>
    </div>
  );
}

export default async function DetalheAlunoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const professor = await getPerfilAtual();
  if (!professor) redirect("/login");

  const { id } = await params;
  const [detalhe, treinosRecentes] = await Promise.all([
    getDetalheAluno(id),
    getTreinosRecentes(id),
  ]);
  if (!detalhe) notFound();

  const { perfil, indicadores, humores, treinos, medicamentos, avaliacoes } =
    detalhe;

  const hoje = hojeISO();
  const inicial = perfil.nome.charAt(0).toUpperCase();
  const condicoes = perfil.avatar_condicao ?? [];
  const telefone = telefoneBonito(perfil.telefone);

  // O mais recente de cada tipo, para a régua de indicadores do topo.
  const ultimos = new Map<string, (typeof indicadores)[number]>();
  for (const registro of indicadores) {
    if (!ultimos.has(registro.tipo)) ultimos.set(registro.tipo, registro);
  }

  const idade = perfil.data_nascimento
    ? Math.floor(
        (Date.parse(`${hoje}T12:00:00Z`) -
          Date.parse(`${perfil.data_nascimento}T12:00:00Z`)) /
          (365.25 * 86_400_000)
      )
    : null;

  const ultimaAvaliacao = avaliacoes[0];

  const anamnese = detalhe.anamnese
    ? (
        [
          ["Objetivo", detalhe.anamnese.objetivo],
          ["Doenças", detalhe.anamnese.doencas?.join(", ")],
          ["Lesões", detalhe.anamnese.lesoes],
          ["Cirurgias", detalhe.anamnese.cirurgias],
          ["Alergias", detalhe.anamnese.alergias],
          ["Medicamentos em uso", detalhe.anamnese.medicamentos_uso],
          ["Restrições médicas", detalhe.anamnese.restricoes_medicas],
          [
            "Liberado por médico",
            detalhe.anamnese.liberado_por_medico === undefined
              ? undefined
              : detalhe.anamnese.liberado_por_medico
                ? "Sim"
                : "Não",
          ],
        ] as const
      ).filter(([, valor]) => valor)
    : null;

  const contatos = [
    { rotulo: "Familiar", nome: perfil.familiar_nome, telefone: perfil.familiar_telefone },
    { rotulo: "Médico", nome: perfil.medico_nome, telefone: perfil.medico_telefone },
  ].filter((c) => c.nome || c.telefone);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-7 px-4 py-6 md:gap-9 md:px-6 md:py-8">
      <Link
        href="/alunos"
        className="-mb-3 flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950 md:-mb-5"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alunos
      </Link>

      {/* ── Identificação ────────────────────────────────────────────── */}
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4 md:gap-5">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-2xl font-semibold text-neutral-500 ring-4 ring-white md:size-24">
            {perfil.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.foto_url} alt="" className="size-full object-cover" />
            ) : (
              inicial || <UserRound className="size-7" aria-hidden />
            )}
          </span>

          <div className="min-w-0">
            <p className="rotulo text-primary">
              Ficha do aluno{idade !== null && ` · ${idade} anos`}
            </p>
            <h1 className="mt-1.5 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-neutral-950 md:text-[34px]">
              {perfil.nome}
            </h1>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {condicoes.length === 0 ? (
                <span className="text-sm text-neutral-400">Sem condição informada</span>
              ) : (
                condicoes.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-card px-2.5 py-0.5 text-[12px] font-semibold text-neutral-600 ring-1 ring-neutral-200"
                  >
                    {AVATAR_CONFIG[c]?.label ?? c}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/chat/${perfil.id}`}
            className="flex h-11 items-center gap-2 rounded-full bg-grafite px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98]"
          >
            <MessageCircle className="size-4" strokeWidth={1.9} aria-hidden />
            Mensagem
          </Link>
          <Link
            href={`/alunos/${perfil.id}/avaliacao`}
            className="flex h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-semibold text-neutral-950 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-50 active:scale-[.98]"
          >
            <ClipboardPlus className="size-4 text-neutral-500" strokeWidth={1.9} aria-hidden />
            Nova avaliação
          </Link>
          {telefone && (
            <a
              href={`tel:${perfil.telefone}`}
              className="flex h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-semibold text-neutral-950 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-50 active:scale-[.98]"
            >
              <Phone className="size-4 text-neutral-500" strokeWidth={1.9} aria-hidden />
              <span className="numero">{telefone}</span>
            </a>
          )}
        </div>
      </header>

      {perfil.observacoes_clinicas && (
        <div className="flex items-start gap-3 rounded-2xl bg-saude-amarelo-light px-5 py-4">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-saude-amarelo"
            strokeWidth={1.9}
            aria-hidden
          />
          <div>
            <p className="rotulo text-[#b45309]">Observação do aluno</p>
            <p className="mt-1 text-[15px] leading-relaxed text-neutral-800">
              {perfil.observacoes_clinicas}
            </p>
          </div>
        </div>
      )}

      {/* ── Resumo ─────────────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-neutral-200/90 ring-1 ring-neutral-200/90 md:grid-cols-4">
        <Metrica
          valor={String(detalhe.treinosNoMes)}
          unidade={detalhe.treinosNoMes === 1 ? "treino" : "treinos"}
          label="Últimos 30 dias"
        />
        <Metrica
          valor={detalhe.esforcoMedio ? detalhe.esforcoMedio.toFixed(1).replace(".", ",") : "-"}
          unidade={detalhe.esforcoMedio ? "/10" : undefined}
          label="Esforço médio"
        />
        <Metrica
          valor={
            detalhe.ultimaPresenca
              ? formatDistanceToNow(new Date(`${detalhe.ultimaPresenca}T12:00:00Z`), {
                  locale: ptBR,
                })
              : "Nunca"
          }
          label="Última presença"
          pequeno
        />
        <Metrica
          valor={String(medicamentos.filter((m) => m.ativo).length)}
          unidade="ativos"
          label="Medicamentos"
        />
      </dl>

      {/* ── Indicadores ────────────────────────────────────────────────── */}
      <section id="indicadores" className="flex scroll-mt-40 flex-col gap-3.5">
        <TituloSecao>Últimos indicadores</TituloSecao>

        {ultimos.size === 0 ? (
          <Vazio icone={Stethoscope}>
            O aluno ainda não registrou nenhuma medição. Vale lembrar na próxima aula,
            e o portão pré-treino também pede.
          </Vazio>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
            {Array.from(ultimos.values()).map((registro) => {
              const config = CONFIG_INDICADORES[registro.tipo];
              const faixa =
                registro.tipo === "peso"
                  ? registro.imc
                    ? { tipo: "peso" as const, valor: registro.imc }
                    : undefined
                  : {
                      tipo: registro.tipo,
                      valor: registro.valorPrincipal,
                      valorSecundario: registro.valorSecundario,
                    };

              return (
                <li key={registro.id} className="flex flex-col gap-1.5">
                  <CardIndicador
                    icone={config.icone}
                    label={config.labelCurto}
                    valor={registro.valorFormatado.replace(" kg", "")}
                    unidade={config.unidade}
                    status={registro.status}
                    badge={registro.badge || undefined}                    faixa={faixa}
                  />
                  <p className="rotulo px-1 text-neutral-400">
                    {formatDistanceToNow(new Date(registro.registradoEm), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Treinos recentes: quando, quanto tempo, quanto fez ────────── */}
      <section id="treinos-recentes" className="flex scroll-mt-40 flex-col gap-3.5">
        <TituloSecao>Treinos recentes</TituloSecao>

        {treinosRecentes.length === 0 ? (
          <Vazio icone={Timer}>
            O aluno ainda não fez treino pelo app. Quando ele marcar a primeira série, a
            execução aparece aqui com o tempo que levou.
          </Vazio>
        ) : (
          <ul className={cn(CARD, "divide-y divide-neutral-200/80 overflow-hidden")}>
            {treinosRecentes.map((execucao) => {
              const dia = new Date(`${execucao.data}T12:00:00Z`);
              const emAndamento = !execucao.concluido && execucao.data === hoje;

              return (
                <li
                  key={execucao.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 md:gap-5 md:px-5"
                >
                  <div className="w-11 text-center">
                    <p className="numero text-xl leading-none font-semibold text-neutral-950">
                      {format(dia, "dd")}
                    </p>
                    <p className="rotulo mt-1 text-neutral-400">
                      {format(dia, "MMM", { locale: ptBR }).replace(".", "")}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-neutral-950">
                      {execucao.treinoNome ?? "Treino"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-[13px] text-neutral-500">
                      <span className="first-letter:uppercase">
                        {format(dia, "EEEE", { locale: ptBR })}
                      </span>
                      {execucao.seriesFeitas > 0 ? (
                        <span>
                          <span className="numero font-semibold text-neutral-800">
                            {execucao.seriesFeitas}
                          </span>
                          {execucao.totalSeries ? `/${execucao.totalSeries}` : ""} séries
                        </span>
                      ) : (
                        <span className="text-neutral-400">séries não marcadas</span>
                      )}
                      {execucao.esforco != null && (
                        <span>
                          esforço{" "}
                          <span className="numero font-semibold text-neutral-800">
                            {execucao.esforco}
                          </span>
                          /10
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-right">
                    {execucao.duracaoSegundos != null ? (
                      <p className="numero flex items-center gap-1.5 text-lg leading-none font-semibold text-neutral-950">
                        <Timer className="size-4 text-ciano" strokeWidth={2} aria-hidden />
                        {formatarDuracao(execucao.duracaoSegundos)}
                      </p>
                    ) : (
                      <p className="text-[13px] text-neutral-400">
                        {execucao.concluido ? "Tempo não medido" : ""}
                      </p>
                    )}
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        execucao.concluido
                          ? "bg-saude-verde-light text-saude-verde"
                          : emAndamento
                            ? "bg-ciano/10 text-primary"
                            : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {execucao.concluido
                        ? "Concluído"
                        : emAndamento
                          ? "Em andamento"
                          : "Não concluído"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid items-start gap-7 lg:grid-cols-2 lg:gap-6">
        {/* ── Anamnese ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <TituloSecao>Anamnese</TituloSecao>

          {anamnese ? (
            <dl className={cn(CARD, "divide-y divide-neutral-200/80 px-5")}>
              {anamnese.map(([rotulo, valor]) => (
                <div
                  key={rotulo}
                  className="grid gap-0.5 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="text-[13px] font-medium text-neutral-500">{rotulo}</dt>
                  <dd className="text-[15px] leading-relaxed text-neutral-950">{valor}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Vazio icone={ClipboardList}>
              O aluno ainda não preencheu a anamnese. Peça antes de prescrever o treino.
            </Vazio>
          )}
        </section>

        {/* ── Avaliação física ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <TituloSecao acao={<LinkSecao href={`/alunos/${perfil.id}/avaliacao`}>Nova avaliação</LinkSecao>}>
            Avaliação física
          </TituloSecao>

          {!ultimaAvaliacao ? (
            <Vazio icone={Stethoscope}>
              Sem avaliação lançada. Sem a altura, o peso do aluno não vira IMC.
            </Vazio>
          ) : (
            <ul className={cn(CARD, "divide-y divide-neutral-200/80 overflow-hidden")}>
              {avaliacoes.slice(0, 4).map((avaliacao) => {
                const statusImc = avaliacao.imc ? calcularSemaforo("peso", avaliacao.imc) : null;

                return (
                  <li key={avaliacao.id} className="flex flex-col gap-2.5 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[15px] font-semibold text-neutral-950">
                        {format(new Date(`${avaliacao.data}T12:00:00Z`), "d 'de' MMMM 'de' yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      {statusImc && avaliacao.imc && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            CHIP_SEMAFORO[statusImc]
                          )}
                        >
                          IMC {String(avaliacao.imc).replace(".", ",")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {(
                        [
                          ["Peso", avaliacao.peso, "kg"],
                          ["Altura", avaliacao.altura, "m"],
                          ["Gordura", avaliacao.percentual_gordura, "%"],
                        ] as const
                      )
                        .filter(([, valor]) => valor)
                        .map(([rotulo, valor, unidade]) => (
                          <div key={rotulo}>
                            <p className="rotulo text-neutral-400">{rotulo}</p>
                            <p className="numero mt-0.5 text-lg leading-tight font-semibold text-neutral-950">
                              {String(valor).replace(".", ",")}
                              <span className="ml-0.5 font-sans text-xs font-medium tracking-normal text-neutral-400">
                                {unidade}
                              </span>
                            </p>
                          </div>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Treinos ──────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <TituloSecao acao={<LinkSecao href="/treinos/novo">Novo treino</LinkSecao>}>
            Treinos
          </TituloSecao>

          {treinos.length === 0 ? (
            <Vazio icone={ClipboardList}>
              Nenhum treino montado para este aluno. Monte o primeiro e ele aparece na
              tela dele na hora.
            </Vazio>
          ) : (
            <ul className={cn(CARD, "divide-y divide-neutral-200/80 overflow-hidden")}>
              {treinos.map((treino) => (
                <li key={treino.id}>
                  <Link
                    href={`/treinos/${treino.id}`}
                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-neutral-950">
                      {treino.nome}
                    </span>
                    {!treino.ativo && (
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500">
                        Inativo
                      </span>
                    )}
                    <ChevronRight
                      className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Medicamentos ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <TituloSecao>Medicamentos</TituloSecao>

          {medicamentos.length === 0 ? (
            <Vazio icone={ClipboardList}>O aluno não cadastrou nenhum medicamento.</Vazio>
          ) : (
            <ul className={cn(CARD, "divide-y divide-neutral-200/80 overflow-hidden")}>
              {medicamentos.map((medicamento) => (
                <li key={medicamento.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-neutral-950">
                      {medicamento.nome}
                      {medicamento.dose && (
                        <span className="font-normal text-neutral-500"> · {medicamento.dose}</span>
                      )}
                    </p>
                    <p className="rotulo mt-1 truncate text-neutral-400">
                      {(medicamento.horarios ?? []).map((h) => h.slice(0, 5)).join(" · ")}
                    </p>
                  </div>
                  {!medicamento.ativo && (
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500">
                      Pausado
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Humor ────────────────────────────────────────────────────── */}
        {humores.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <TituloSecao>Humor em 30 dias</TituloSecao>

            <div className={cn(CARD, "flex flex-wrap gap-1.5 p-4 md:p-5")}>
              {humores
                .slice()
                .reverse()
                .map((registro) => (
                  <span
                    key={registro.data}
                    title={`${format(new Date(`${registro.data}T12:00:00Z`), "dd/MM")}: ${HUMOR_CONFIG[registro.humor].label}`}
                    className="flex size-9 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: `${HUMOR_CONFIG[registro.humor].cor}1f` }}
                  >
                    <span aria-hidden>{HUMOR_CONFIG[registro.humor].emoji}</span>
                    <span className="sr-only">
                      {format(new Date(`${registro.data}T12:00:00Z`), "dd/MM")}:{" "}
                      {HUMOR_CONFIG[registro.humor].label}
                    </span>
                  </span>
                ))}
            </div>
          </section>
        )}

        {/* ── Contatos de emergência ───────────────────────────────────── */}
        {contatos.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <TituloSecao>Em caso de emergência</TituloSecao>

            <ul className={cn(CARD, "divide-y divide-neutral-200/80 overflow-hidden")}>
              {contatos.map((contato) => (
                <li key={contato.rotulo} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="rotulo text-neutral-400">{contato.rotulo}</p>
                    <p className="mt-0.5 truncate text-[15px] font-semibold text-neutral-950">
                      {contato.nome ?? "Nome não informado"}
                    </p>
                  </div>
                  {contato.telefone && (
                    <a
                      href={`tel:${contato.telefone}`}
                      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-primary ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
                    >
                      <Phone className="size-3.5" strokeWidth={1.9} aria-hidden />
                      <span className="numero">{telefoneBonito(contato.telefone)}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <p className="rotulo text-neutral-400">
        Atualizado às {horaAtual()} · fuso da academia
      </p>
    </main>
  );
}

function Metrica({
  valor,
  unidade,
  label,
  pequeno,
}: {
  valor: string;
  unidade?: string;
  label: string;
  /** Texto longo ("há 3 dias") não cabe no tamanho de número. */
  pequeno?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 bg-card px-4 py-4 md:px-5 md:py-5">
      <dt className="text-[13px] font-medium text-neutral-500">{label}</dt>
      <dd
        className={cn(
          "numero leading-none font-semibold text-neutral-950 first-letter:uppercase",
          pequeno ? "text-xl md:text-2xl" : "text-[28px] md:text-[32px]"
        )}
      >
        {valor}
        {unidade && (
          <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
            {unidade}
          </span>
        )}
      </dd>
    </div>
  );
}
