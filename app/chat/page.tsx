import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, MessageSquare, UserRound } from "lucide-react";

import { getConversas } from "@/lib/supabase/chat";
import { getPerfilAtual } from "@/lib/supabase/perfil";

export default async function ChatPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const conversas = await getConversas(perfil);
  const voltar = perfil.role === "professor" ? "/dashboard" : "/home";

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={voltar}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Conversas
        </h1>
      </header>

      {conversas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <MessageSquare className="size-5" aria-hidden />
          </span>
          <p className="text-base font-semibold text-neutral-900">
            Ninguém para conversar ainda
          </p>
          <p className="max-w-xs text-sm text-neutral-500">
            {perfil.role === "professor"
              ? "Assim que houver alunos cadastrados, eles aparecem aqui."
              : "Assim que o centro cadastrar seu professor, ele aparece aqui."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {conversas.map(({ contato, ultimaMensagem, naoLidas }) => (
            <li key={contato.id}>
              <Link
                href={`/chat/${contato.id}`}
                className="flex items-center gap-3 p-3.5 transition-colors hover:bg-neutral-50"
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-base font-semibold text-neutral-500">
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
                  <p className="truncate text-xs text-neutral-500">
                    {ultimaMensagem?.texto ?? "Nenhuma mensagem ainda"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {ultimaMensagem && (
                    <span className="text-xs text-neutral-400">
                      {formatDistanceToNow(
                        new Date(ultimaMensagem.created_at),
                        { addSuffix: true, locale: ptBR }
                      )}
                    </span>
                  )}
                  {naoLidas > 0 && (
                    <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-white">
                      {naoLidas}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
