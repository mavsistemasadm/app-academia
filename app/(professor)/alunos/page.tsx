import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, UserPlus } from "lucide-react";

import { ListaAlunos } from "@/components/professor/ListaAlunos";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getPainelProfessor } from "@/lib/supabase/painel-professor";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function AlunosPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { alunos } = await getPainelProfessor(perfil.id);

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
    </main>
  );
}
