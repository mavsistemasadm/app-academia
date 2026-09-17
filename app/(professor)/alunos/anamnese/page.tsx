import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EditorAnamnese } from "@/components/professor/EditorAnamnese";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getPerguntasAnamnese } from "@/lib/supabase/anamnese";
import { createClient } from "@/lib/supabase/server";

export default async function PerguntasAnamnesePage() {
  const supabase = await createClient();
  const { perguntas, editavel } = await getPerguntasAnamnese(supabase, {
    incluirArquivadas: true,
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
      <Link
        href="/alunos"
        className="-mb-3 flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950 md:-mb-5"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alunos
      </Link>

      <div className="-mx-5 -mt-7 md:m-0">
        <CabecalhoPagina
          rotulo="Acompanhamento"
          titulo="Perguntas da anamnese"
          descricao="O formulário de saúde que todo aluno preenche. Edite, reordene, arquive ou crie perguntas: a mudança chega para todos na hora."
        />
      </div>

      <EditorAnamnese perguntas={perguntas} editavel={editavel} />
    </main>
  );
}
