import { redirect } from "next/navigation";

import { DosesDoDia } from "@/components/aluno/DosesDoDia";
import { GerenciarMedicamentos } from "@/components/aluno/GerenciarMedicamentos";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
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
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Cuidado diário"
        titulo="Remédios"
        descricao={
          doses.length === 0
            ? "Cadastre seus medicamentos para o centro acompanhar junto."
            : pendentes > 0
              ? `${pendentes} ${pendentes === 1 ? "dose atrasada" : "doses atrasadas"} hoje.`
              : `${tomadas} de ${doses.length} confirmadas hoje. Tudo em dia.`
        }
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Doses de hoje
          </h2>
          <DosesDoDia alunoId={perfil.id} doses={doses} hoje={hoje} />
        </section>

        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
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
