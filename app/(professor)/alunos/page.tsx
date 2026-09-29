import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ClipboardList, UserPlus } from "lucide-react";

import { ListaAlunos } from "@/components/professor/ListaAlunos";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { ehAdmin } from "@/lib/supabase/equipe";
import { getPainelProfessor } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";

export default async function AlunosPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const admin = ehAdmin(perfil);
  const supabase = await createClient();
  const [{ alunos }, { data: inativos }] = await Promise.all([
    getPainelProfessor(perfil.id),
    // Inativo só volta pela ficha, e só o admin reativa: a lista é dele.
    admin
      ? supabase
          .from("profiles")
          .select("id, nome")
          .eq("role", "aluno")
          .eq("ativo", false)
          .order("nome")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Acompanhamento"
          titulo="Alunos"
          descricao="Quem precisa de atenção aparece primeiro."
          acao={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/alunos/anamnese"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-card px-5 text-[15px] font-semibold text-neutral-950 ring-1 ring-neutral-200/90 transition-all duration-200 hover:bg-neutral-50 active:scale-[.98]"
              >
                <ClipboardList
                  className="size-5 text-neutral-400"
                  strokeWidth={1.8}
                  aria-hidden
                />
                Anamnese
              </Link>
              <Link
                href="/alunos/convidar"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-grafite px-5 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98]"
              >
                <UserPlus className="size-5" strokeWidth={1.8} aria-hidden />
                Convidar aluno
              </Link>
            </div>
          }
        />
      </div>

      <ListaAlunos alunos={alunos} />

      {inativos && inativos.length > 0 && (
        <details className="group max-w-2xl rounded-2xl bg-card ring-1 ring-neutral-200/90">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold text-neutral-950">
            <span>
              Inativos{" "}
              <span className="numero font-medium text-neutral-400">{inativos.length}</span>
            </span>
            <ChevronRight
              className="size-4 text-neutral-400 transition-transform group-open:rotate-90"
              aria-hidden
            />
          </summary>
          <ul className="border-t border-neutral-200/90">
            {inativos.map((aluno) => (
              <li key={aluno.id} className="border-b border-neutral-100 last:border-0">
                <Link
                  href={`/alunos/${aluno.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 text-[15px] text-neutral-600 transition-colors hover:bg-neutral-50"
                >
                  {aluno.nome}
                  <span className="text-sm font-semibold text-primary">Reativar ou excluir</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
