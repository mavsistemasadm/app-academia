import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Users } from "lucide-react";

import { AlertasRealtime } from "@/components/professor/AlertasRealtime";
import { CardAluno } from "@/components/professor/CardAluno";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getPainelProfessor } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { cn } from "@/lib/utils";

/** Quantos alunos o painel mostra antes de mandar para a lista completa. */
const LIMITE_NA_HOME = 8;

export default async function DashboardPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { alunos, alertas, presentes, resumo, hoje } = await getPainelProfessor(
    perfil.id
  );

  const precisamAtencao = alunos.filter((a) => a.status !== "verde");
  const emDestaque =
    precisamAtencao.length > 0
      ? precisamAtencao.slice(0, LIMITE_NA_HOME)
      : alunos.slice(0, LIMITE_NA_HOME);

  // `hoje` já vem no fuso da academia; meio-dia UTC não vira o dia errado.
  const dataExtenso = format(new Date(`${hoje}T12:00:00Z`), "EEEE, d 'de' MMMM", {
    locale: ptBR,
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-7 px-4 py-6 md:gap-9 md:px-6 md:py-8">
      {/* O cabeçalho traz padding de tela do aluno; aqui quem dá o respiro é o main. */}
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo={dataExtenso}
          titulo="Painel do dia"
          descricao={
            resumo.total === 0
              ? "Nenhum aluno cadastrado ainda."
              : `${resumo.total} ${resumo.total === 1 ? "aluno" : "alunos"} acompanhados · ${presentes.length} na academia agora.`
          }
        />
      </div>

      {/* ── Números do dia: um bloco, quatro leituras ─────────────── */}
      <section aria-label="Números do dia">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-neutral-200/90 ring-1 ring-neutral-200/90 md:grid-cols-4">
          <Metrica
            valor={resumo.criticos}
            label="em estado crítico"
            destaque={resumo.criticos > 0 ? "vermelho" : undefined}
          />
          <Metrica
            valor={resumo.atencao}
            label="pedindo atenção"
            destaque={resumo.atencao > 0 ? "amarelo" : undefined}
          />
          <Metrica valor={resumo.treinaramHoje} label="treinaram hoje" />
          <Metrica
            valor={resumo.sumidos}
            label="sumidos há 5+ dias"
            destaque={resumo.sumidos > 0 ? "amarelo" : undefined}
          />
        </dl>
      </section>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-6">
        {/* ── Alertas em tempo real ────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Alertas
          </h2>
          <AlertasRealtime professorId={perfil.id} alertasIniciais={alertas} />
        </section>

        {/* ── Alunos ───────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
              {precisamAtencao.length > 0 ? "Precisam de atenção" : "Seus alunos"}
            </h2>
            {alunos.length > emDestaque.length && (
              <Link
                href="/alunos"
                className="group flex items-center gap-1 text-sm font-semibold text-primary"
              >
                Ver todos
                <ArrowRight
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            )}
          </div>

          {alunos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
              <Users className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
              <p className="text-[15px] font-semibold text-neutral-950">Nenhum aluno ainda</p>
              <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
                Assim que alguém criar conta no app, aparece aqui com o semáforo de
                saúde do dia.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {emDestaque.map((aluno) => (
                <li key={aluno.perfil.id}>
                  <CardAluno aluno={aluno} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Metrica({
  valor,
  label,
  destaque,
}: {
  valor: number;
  label: string;
  destaque?: "vermelho" | "amarelo";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-4 py-4 md:px-5 md:py-5",
        destaque === "vermelho" ? "bg-saude-vermelho-light" : "bg-card"
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 text-[13px] font-medium",
          destaque === "vermelho" ? "text-[#b91c1c]" : "text-neutral-500"
        )}
      >
        {destaque && (
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full",
              destaque === "vermelho" ? "bg-saude-vermelho" : "bg-saude-amarelo"
            )}
          />
        )}
        {label}
      </dt>
      <dd
        className={cn(
          "numero text-[32px] leading-none font-semibold md:text-[40px]",
          destaque === "vermelho"
            ? "text-saude-vermelho"
            : destaque === "amarelo"
              ? "text-[#b45309]"
              : "text-neutral-950"
        )}
      >
        {valor}
      </dd>
    </div>
  );
}
