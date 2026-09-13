import { redirect } from "next/navigation";

import Link from "next/link";
import { ChevronRight, ClipboardList, FileText, Users } from "lucide-react";

import { FormularioPerfil } from "@/components/aluno/FormularioPerfil";
import { BotaoSair } from "@/components/shared/BotaoSair";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { GerenciarNotificacoes } from "@/components/shared/GerenciarNotificacoes";
import { getPerfilAtual } from "@/lib/supabase/perfil";

const ATALHOS = [
  {
    href: "/relatorio",
    icone: FileText,
    titulo: "Relatório para o médico",
    texto: "O mês inteiro numa folha para levar na consulta.",
  },
  {
    href: "/anamnese",
    icone: ClipboardList,
    titulo: "Anamnese",
    texto: "Seu histórico de saúde, que o professor lê antes do treino.",
  },
  {
    href: "/familiares",
    icone: Users,
    titulo: "Familiares",
    texto: "Quem pode acompanhar seus indicadores e sua frequência.",
  },
];

export default async function PerfilPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina rotulo="Sua conta" titulo="Perfil" acao={<BotaoSair />} />

      <div className="flex w-full max-w-3xl flex-col gap-6 px-5 md:gap-8 md:px-0">
        <FormularioPerfil perfil={perfil} />

        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Lembretes e documentos
          </h2>

          <div className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
            <GerenciarNotificacoes />

            {ATALHOS.map(({ href, icone: Icone, titulo, texto }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-neutral-50"
              >
                <Icone className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-neutral-950">{titulo}</p>
                  <p className="text-sm text-neutral-500">{texto}</p>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
