import { redirect } from "next/navigation";

import { GerenciarExames } from "@/components/aluno/GerenciarExames";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getExamesAluno } from "@/lib/supabase/exames";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { hojeISO } from "@/lib/utils/datas";

export const metadata = { title: "Exames" };

export default async function ExamesPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { exames, compartilhamentos, indisponivel } = await getExamesAluno(
    perfil.id
  );

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Saúde"
        titulo="Exames"
        descricao={
          exames.length === 0
            ? "Guarde aqui os PDFs do laboratório e os exames de imagem. Na consulta, é só mandar o link para o médico."
            : `${exames.length} ${exames.length === 1 ? "exame guardado" : "exames guardados"}. Mande o link para o médico quando precisar.`
        }
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <GerenciarExames
          alunoId={perfil.id}
          exames={exames}
          compartilhamentos={compartilhamentos}
          hoje={hojeISO()}
          indisponivel={indisponivel}
        />
      </div>
    </div>
  );
}
