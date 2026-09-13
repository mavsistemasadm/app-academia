import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  ClipboardList,
  Dumbbell,
  Phone,
  Pill,
  Stethoscope,
  UserRound,
} from "lucide-react";

import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getDetalheAluno } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { rotularCondicoes } from "@/lib/utils/avatares";
import { hojeISO, horaAtual } from "@/lib/utils/datas";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";
import { HUMOR_CONFIG } from "@/lib/utils/saudacao";
import { SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const CORES_SEMAFORO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde-light text-saude-verde",
  amarelo: "bg-saude-amarelo-light text-saude-amarelo",
  vermelho: "bg-saude-vermelho-light text-saude-vermelho",
};

function telefoneBonito(digitos?: string) {
  if (!digitos) return null;
  const d = digitos.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

export default async function DetalheAlunoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const professor = await getPerfilAtual();
  if (!professor) redirect("/login");

  const { id } = await params;
  const detalhe = await getDetalheAluno(id);
  if (!detalhe) notFound();

  const { perfil, indicadores, humores, treinos, medicamentos, avaliacoes } =
    detalhe;

  const hoje = hojeISO();
  const inicial = perfil.nome.charAt(0).toUpperCase();

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

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-6">
      <Link
        href="/alunos"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alunos
      </Link>

      {/* ── Identificação ──────────────────────────────────────────── */}
      <header className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-xl font-semibold text-neutral-500">
          {perfil.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.foto_url}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            inicial || <UserRound className="size-6" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            {perfil.nome}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {rotularCondicoes(perfil.avatar_condicao)}
            {idade !== null && ` · ${idade} anos`}
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {telefoneBonito(perfil.telefone) && (
              <a
                href={`tel:${perfil.telefone}`}
                className="flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
              >
                <Phone className="size-3.5" aria-hidden />
                {telefoneBonito(perfil.telefone)}
              </a>
            )}
            <Link
              href={`/chat/${perfil.id}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              Enviar mensagem
            </Link>
          </div>
        </div>
      </header>

      {perfil.observacoes_clinicas && (
        <p className="rounded-xl border border-saude-amarelo/40 bg-saude-amarelo-light/40 px-4 py-3 text-sm text-neutral-800">
          <span className="font-semibold">Observação do aluno: </span>
          {perfil.observacoes_clinicas}
        </p>
      )}

      {/* ── Resumo ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero valor={String(detalhe.treinosNoMes)} label="treinos em 30 dias" />
        <Numero
          valor={
            detalhe.esforcoMedio
              ? `${detalhe.esforcoMedio.toFixed(1)}/10`
              : "—"
          }
          label="esforço médio"
        />
        <Numero
          valor={
            detalhe.ultimaPresenca
              ? formatDistanceToNow(
                  new Date(`${detalhe.ultimaPresenca}T12:00:00Z`),
                  { locale: ptBR }
                )
              : "nunca"
          }
          label="última presença"
        />
        <Numero
          valor={String(medicamentos.filter((m) => m.ativo).length)}
          label="medicamentos ativos"
        />
      </section>

      {/* ── Indicadores ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Últimos indicadores
        </h2>

        {ultimos.size === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
            O aluno ainda não registrou nenhuma medição.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from(ultimos.values()).map((registro) => {
              const config =
                CONFIG_INDICADORES[
                  registro.tipo as keyof typeof CONFIG_INDICADORES
                ];

              return (
                <li
                  key={registro.id}
                  className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-white p-3.5"
                >
                  <p className="text-lg leading-tight font-bold text-neutral-900 tabular-nums">
                    {registro.valorFormatado}
                  </p>
                  <p className="text-xs text-neutral-500">{config.labelCurto}</p>
                  <span
                    className={cn(
                      "w-fit rounded-md px-2 py-0.5 text-xs font-semibold",
                      CORES_SEMAFORO[registro.status]
                    )}
                  >
                    {registro.badge || SEMAFORO_CONFIG[registro.status].label}
                  </span>
                  <p className="text-xs text-neutral-400">
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

      {/* ── Anamnese ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Anamnese
        </h2>

        {detalhe.anamnese ? (
          <dl className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white p-4">
            {(
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
            )
              .filter(([, valor]) => valor)
              .map(([rotulo, valor]) => (
                <div key={rotulo} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-neutral-500">
                    {rotulo}
                  </dt>
                  <dd className="text-sm text-neutral-800">{valor}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
              <ClipboardList className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-neutral-500">
              O aluno ainda não preencheu a anamnese. Peça antes de prescrever
              o treino.
            </p>
          </div>
        )}
      </section>

      {/* ── Treinos e medicamentos ─────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Treinos
            </h2>
            <Link
              href="/treinos/novo"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Novo treino
            </Link>
          </div>

          {treinos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
              Nenhum treino montado.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {treinos.map((treino) => (
                <li key={treino.id}>
                  <Link
                    href={`/treinos/${treino.id}`}
                    className="flex items-center gap-3 p-3.5 transition-colors hover:bg-neutral-50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                      <Dumbbell className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                      {treino.nome}
                    </span>
                    {!treino.ativo && (
                      <span className="shrink-0 text-xs text-neutral-400">
                        Inativo
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Medicamentos
          </h2>

          {medicamentos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
              Nenhum medicamento cadastrado.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
              {medicamentos.map((medicamento) => (
                <li
                  key={medicamento.id}
                  className="flex items-center gap-3 p-3.5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <Pill className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {medicamento.nome}
                      {medicamento.dose && (
                        <span className="font-normal text-neutral-500">
                          {" "}
                          · {medicamento.dose}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {(medicamento.horarios ?? [])
                        .map((h) => h.slice(0, 5))
                        .join(" · ")}
                    </p>
                  </div>
                  {!medicamento.ativo && (
                    <span className="shrink-0 text-xs text-neutral-400">
                      Pausado
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Humor ──────────────────────────────────────────────────── */}
      {humores.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Humor nos últimos 30 dias
          </h2>

          <div className="flex flex-wrap gap-1.5 rounded-xl border border-neutral-200 bg-white p-4">
            {humores
              .slice()
              .reverse()
              .map((registro) => (
                <span
                  key={registro.data}
                  title={`${format(new Date(`${registro.data}T12:00:00Z`), "dd/MM")} — ${HUMOR_CONFIG[registro.humor].label}`}
                  className="flex size-9 items-center justify-center rounded-md text-lg"
                  style={{
                    backgroundColor: `${HUMOR_CONFIG[registro.humor].cor}22`,
                  }}
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

      {/* ── Avaliação física ───────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Avaliação física
          </h2>
          <Link
            href={`/alunos/${perfil.id}/avaliacao`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Nova avaliação
          </Link>
        </div>

        {!ultimaAvaliacao ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
              <Stethoscope className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-neutral-500">
              Sem avaliação lançada. Sem a altura, o peso do aluno não vira IMC.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {avaliacoes.slice(0, 4).map((avaliacao) => (
              <li key={avaliacao.id} className="flex flex-col gap-1 p-3.5">
                <p className="text-sm font-medium text-neutral-900">
                  {format(
                    new Date(`${avaliacao.data}T12:00:00Z`),
                    "dd 'de' MMMM 'de' yyyy",
                    { locale: ptBR }
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  {[
                    avaliacao.peso && `${avaliacao.peso} kg`,
                    avaliacao.altura && `${avaliacao.altura} m`,
                    avaliacao.imc && `IMC ${avaliacao.imc}`,
                    avaliacao.percentual_gordura &&
                      `${avaliacao.percentual_gordura}% gordura`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Contatos de emergência ─────────────────────────────────── */}
      {(perfil.familiar_nome || perfil.medico_nome) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Em caso de emergência
          </h2>

          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {[
              {
                rotulo: "Familiar",
                nome: perfil.familiar_nome,
                telefone: perfil.familiar_telefone,
              },
              {
                rotulo: "Médico",
                nome: perfil.medico_nome,
                telefone: perfil.medico_telefone,
              },
            ]
              .filter((c) => c.nome || c.telefone)
              .map((contato) => (
                <li
                  key={contato.rotulo}
                  className="flex items-center gap-3 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-500">{contato.rotulo}</p>
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {contato.nome ?? "—"}
                    </p>
                  </div>
                  {contato.telefone && (
                    <a
                      href={`tel:${contato.telefone}`}
                      className="flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <Phone className="size-3.5" aria-hidden />
                      {telefoneBonito(contato.telefone)}
                    </a>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-neutral-400">
        Atualizado às {horaAtual()} · fuso da academia
      </p>
    </main>
  );
}

function Numero({ valor, label }: { valor: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xl leading-tight font-bold tracking-tight text-neutral-900">
        {valor}
      </p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
