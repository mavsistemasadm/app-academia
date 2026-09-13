import Link from "next/link";
import { redirect } from "next/navigation";

import { GerenciarFamiliares } from "@/components/aluno/GerenciarFamiliares";
import { getFamiliaresDoAluno } from "@/lib/supabase/familiares";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function FamiliaresPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const familiares = await getFamiliaresDoAluno(perfil.id);
  const ativos = familiares.filter((f) => f.status === "ativo").length;

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Familiares</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {ativos === 0
            ? "Ninguém acompanhando você por enquanto."
            : `${ativos} ${ativos === 1 ? "familiar acompanha" : "familiares acompanham"} sua saúde.`}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <div className="-mt-14 md:mt-0">
          <GerenciarFamiliares alunoId={perfil.id} familiares={familiares} />
        </div>

        <p className="text-sm text-neutral-500">
          Você é o familiar de alguém?{" "}
          <Link
            href="/acompanhar"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Use seu código aqui
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
