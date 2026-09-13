import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { AlertasRealtime } from "@/components/professor/AlertasRealtime";
import { CardAluno } from "@/components/professor/CardAluno";
import { getPainelProfessor } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";

/** Quantos alunos o painel mostra antes de mandar para a lista completa. */
const LIMITE_NA_HOME = 8;

export default async function DashboardPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { alunos, alertas, presentes, resumo } = await getPainelProfessor(
    perfil.id
  );

  const precisamAtencao = alunos.filter((a) => a.status !== "verde");
  const emDestaque =
    precisamAtencao.length > 0
      ? precisamAtencao.slice(0, LIMITE_NA_HOME)
      : alunos.slice(0, LIMITE_NA_HOME);

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Painel
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {resumo.total === 0
            ? "Nenhum aluno cadastrado ainda."
            : `${resumo.total} ${resumo.total === 1 ? "aluno" : "alunos"} · ${presentes.length} na academia agora.`}
        </p>
      </header>

      {/* ── Números do dia ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero
          valor={resumo.criticos}
          label="em estado crítico"
          cor={resumo.criticos > 0 ? "text-saude-vermelho" : undefined}
        />
        <Numero
          valor={resumo.atencao}
          label="pedindo atenção"
          cor={resumo.atencao > 0 ? "text-saude-amarelo" : undefined}
        />
        <Numero valor={resumo.treinaramHoje} label="treinaram hoje" />
        <Numero
          valor={resumo.sumidos}
          label="sumidos há 5+ dias"
          cor={resumo.sumidos > 0 ? "text-saude-amarelo" : undefined}
        />
      </section>

      {/* ── Alertas em tempo real ──────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Alertas
        </h2>
        <AlertasRealtime professorId={perfil.id} alertasIniciais={alertas} />
      </section>

      {/* ── Alunos ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            {precisamAtencao.length > 0 ? "Precisam de atenção" : "Seus alunos"}
          </h2>
          {alunos.length > emDestaque.length && (
            <Link
              href="/alunos"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver todos
            </Link>
          )}
        </div>

        {alunos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <Users className="size-5" aria-hidden />
            </span>
            <p className="text-base font-semibold text-neutral-900">
              Nenhum aluno ainda
            </p>
            <p className="max-w-xs text-sm text-neutral-500">
              Assim que alguém criar conta no app, aparece aqui com o semáforo
              de saúde do dia.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {emDestaque.map((aluno) => (
              <li key={aluno.perfil.id}>
                <CardAluno aluno={aluno} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Numero({
  valor,
  label,
  cor,
}: {
  valor: number;
  label: string;
  cor?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4">
      <p
        className={`text-2xl leading-tight font-bold tracking-tight tabular-nums ${cor ?? "text-neutral-900"}`}
      >
        {valor}
      </p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
