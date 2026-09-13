import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { FormularioAnamnese } from "@/components/aluno/FormularioAnamnese";
import type { Anamnese } from "@/lib/types";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createClient } from "@/lib/supabase/server";

export default async function AnamnesePage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("anamneses")
    .select("*")
    .eq("aluno_id", perfil.id)
    .maybeSingle();

  const anamnese = (data as Anamnese | null) ?? null;

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Anamnese</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {anamnese
            ? `Atualizada em ${format(new Date(anamnese.atualizado_em), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`
            : "Seu histórico de saúde. O professor consulta antes de montar qualquer treino."}
        </p>
      </header>

      <div className="-mt-14 px-5 md:mt-0 md:px-0">
        <FormularioAnamnese alunoId={perfil.id} anamnese={anamnese} />
      </div>
    </div>
  );
}
