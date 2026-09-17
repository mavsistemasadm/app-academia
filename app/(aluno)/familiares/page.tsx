import Link from "next/link";
import { redirect } from "next/navigation";

import { GerenciarFamiliares } from "@/components/aluno/GerenciarFamiliares";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getFamiliaresDoAluno } from "@/lib/supabase/familiares";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function FamiliaresPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const familiares = await getFamiliaresDoAluno(perfil.id);
  const ativos = familiares.filter((f) => f.status === "ativo").length;

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Família"
        titulo="Dar acesso à família"
        descricao={
          ativos === 0
            ? "Convide quem cuida de você para acompanhar seus indicadores de longe."
            : `${ativos} ${ativos === 1 ? "familiar acompanha" : "familiares acompanham"} sua saúde.`
        }
      />

      <div className="flex w-full max-w-3xl flex-col gap-6 px-5 md:gap-8 md:px-0">
        <GerenciarFamiliares alunoId={perfil.id} familiares={familiares} />

        <p className="text-sm text-neutral-500">
          Quer o contrário, acompanhar alguém que recebeu um código?{" "}
          <Link
            href="/acompanhar"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Digite em Acompanhar um familiar →
          </Link>
        </p>
      </div>
    </div>
  );
}
