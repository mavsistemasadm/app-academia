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
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <Link
          href="/chat"
          aria-label="Voltar para as conversas"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>

        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-semibold text-neutral-500">
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
          <p className="truncate text-sm font-semibold text-neutral-900">
            {contato.nome}
          </p>
          {perfil.role === "professor" && (
            <p className="truncate text-xs text-neutral-500">
              {rotularCondicoes(contato.avatar_condicao)}
            </p>
          )}
        </div>

        {perfil.role === "professor" && (
          <Link
            href={`/alunos/${contato.id}`}
            className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver ficha
          </Link>
        )}
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
