import { redirect } from "next/navigation";

import Link from "next/link";
import { FileText } from "lucide-react";

import { FormularioPerfil } from "@/components/aluno/FormularioPerfil";
import { BotaoSair } from "@/components/shared/BotaoSair";
import { GerenciarNotificacoes } from "@/components/shared/GerenciarNotificacoes";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { rotularCondicoes } from "@/lib/utils/avatares";

export default async function PerfilPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
            <p className="mt-2 max-w-xl text-base text-white/90">
              {rotularCondicoes(perfil.avatar_condicao)}
            </p>
          </div>
          <div className="shrink-0">
            <BotaoSair />
          </div>
        </div>
      </header>

      <div className="-mt-14 flex flex-col gap-6 px-5 md:mt-0 md:px-0">
        <GerenciarNotificacoes />

        <Link
          href="/relatorio"
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900">
              Relatório para o médico
            </p>
            <p className="text-xs text-neutral-500">
              Um PDF com o mês inteiro para levar na consulta.
            </p>
          </div>
        </Link>

        <FormularioPerfil perfil={perfil} />
      </div>
    </div>
  );
}
