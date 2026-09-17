import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { FormularioAnamnese } from "@/components/aluno/FormularioAnamnese";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import type { Anamnese } from "@/lib/types";
import { getPerguntasAnamnese } from "@/lib/supabase/anamnese";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";
import { naAcademia } from "@/lib/utils/datas";

export default async function AnamnesePage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const supabase = await createClient();
  const [{ data }, { perguntas, editavel }] = await Promise.all([
    supabase.from("anamneses").select("*").eq("aluno_id", perfil.id).maybeSingle(),
    getPerguntasAnamnese(supabase),
  ]);

  const anamnese = (data as Anamnese | null) ?? null;

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Saúde"
        titulo="Anamnese"
        descricao={
          anamnese
            ? `Atualizada em ${format(naAcademia(anamnese.atualizado_em), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}. Mudou alguma coisa? É só editar e salvar.`
            : "Seu histórico de saúde. O professor consulta antes de montar qualquer treino."
        }
      />

      <div className="w-full max-w-3xl px-5 md:px-0">
        <FormularioAnamnese
          alunoId={perfil.id}
          anamnese={anamnese}
          perguntas={perguntas}
          editavel={editavel}
        />
      </div>
    </div>
  );
}
