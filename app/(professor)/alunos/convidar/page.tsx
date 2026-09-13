import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ConvidarAluno } from "@/components/professor/ConvidarAluno";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { listarConvitesPendentes, type ConvitePendente } from "@/lib/supabase/convites";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function ConvidarAlunoPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");
  if (perfil.role !== "professor") redirect("/home");

  // Service role só aqui, no servidor: o cliente recebe a lista já filtrada.
  let pendentes: ConvitePendente[] = [];
  let erroPendentes = false;
  try {
    pendentes = await listarConvitesPendentes();
  } catch {
    erroPendentes = true;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Acompanhamento"
          titulo="Convidar aluno"
          descricao="O aluno recebe um e-mail, cria a senha e já entra no app."
          acao={
            <Link
              href="/alunos"
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-neutral-600 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-100 active:scale-[.98]"
            >
              <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />
              Alunos
            </Link>
          }
        />
      </div>

      <ConvidarAluno pendentes={pendentes} erroPendentes={erroPendentes} />
    </main>
  );
}
