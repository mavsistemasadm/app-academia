import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";

import { JanelaChat } from "@/components/shared/JanelaChat";
import { getConversa } from "@/lib/supabase/chat";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { rotularCondicoes } from "@/lib/utils/avatares";

export default async function ConversaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { id } = await params;
  const conversa = await getConversa(perfil, id);
  if (!conversa) notFound();

  const { contato, mensagens } = conversa;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/chat"
            aria-label="Voltar para as conversas"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-neutral-600 ring-1 ring-neutral-200/90 transition-colors hover:text-neutral-950"
          >
            <ArrowLeft className="size-5" strokeWidth={1.9} aria-hidden />
          </Link>

          <span className="numero flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-grafite text-sm font-semibold text-white">
            {contato.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contato.foto_url}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              contato.nome.charAt(0).toUpperCase() || (
                <UserRound className="size-5" aria-hidden />
              )
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
              {contato.nome}
            </p>
            {perfil.role === "professor" && (
              <p className="truncate text-[13px] text-neutral-500">
                {rotularCondicoes(contato.avatar_condicao)}
              </p>
            )}
          </div>

          {perfil.role === "professor" && (
            <Link
              href={`/alunos/${contato.id}`}
              className="flex h-9 shrink-0 items-center rounded-full bg-card px-3.5 text-sm font-semibold text-primary ring-1 ring-neutral-200/90 transition-colors hover:bg-neutral-50"
            >
              Ver ficha
            </Link>
          )}
        </div>
      </header>

      <JanelaChat
        meuId={perfil.id}
        contatoId={contato.id}
        contatoNome={contato.nome}
        mensagensIniciais={mensagens}
      />
    </div>
  );
}
