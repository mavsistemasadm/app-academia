import { redirect } from "next/navigation";

import { DosesDoDia } from "@/components/aluno/DosesDoDia";
import { GerenciarMedicamentos } from "@/components/aluno/GerenciarMedicamentos";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getRemediosAluno } from "@/lib/supabase/remedios";

export default async function RemediosPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { medicamentos, doses, hoje, tomadas } = await getRemediosAluno(
    perfil.id
  );

  const pendentes = doses.filter((d) => d.situacao === "atrasada").length;

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Remédios</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {doses.length === 0
            ? "Cadastre seus medicamentos para o centro acompanhar junto."
            : pendentes > 0
              ? `${pendentes} ${pendentes === 1 ? "dose atrasada" : "doses atrasadas"} hoje.`
              : `${tomadas} de ${doses.length} confirmadas hoje. Tudo em dia.`}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <section className="-mt-14 flex flex-col gap-3 md:mt-0">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase max-md:sr-only">
            Hoje
          </h2>
          <DosesDoDia alunoId={perfil.id} doses={doses} hoje={hoje} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Meus medicamentos
          </h2>
          <GerenciarMedicamentos
            alunoId={perfil.id}
            medicamentos={medicamentos}
          />
        </section>
      </div>
    </div>
  );
}
