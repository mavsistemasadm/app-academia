import { redirect } from "next/navigation";

import { GerenciarAulas } from "@/components/professor/GerenciarAulas";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { DIAS_DE_AGENDA, getAulasDoPeriodo, getGrade, getInscritos } from "@/lib/supabase/aulas";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";
import { hojeISO, horaAtual, somarDiasISO } from "@/lib/utils/datas";
import { horaCurta } from "@/lib/utils/aulas";

export default async function AulasProfessorPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const supabase = await createClient();
  const hoje = hojeISO();
  const fim = somarDiasISO(hoje, DIAS_DE_AGENDA);

  const [{ grade, indisponivel }, { aulas }, inscritos] = await Promise.all([
    getGrade(),
    getAulasDoPeriodo(supabase, hoje, fim),
    getInscritos(supabase, hoje, fim),
  ]);

  const agora = horaAtual();
  const proximas = aulas.filter((a) => a.data > hoje || horaCurta(a.hora) >= agora);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Turma"
          titulo="Aulas"
          descricao="A grade da semana e quem marcou cada horário. O aluno escolhe o dia; o limite de vagas é do banco, não da tela."
        />
      </div>

      <GerenciarAulas
        professorId={perfil.id}
        grade={grade}
        proximas={proximas}
        inscritos={inscritos}
        indisponivel={indisponivel}
      />
    </main>
  );
}
