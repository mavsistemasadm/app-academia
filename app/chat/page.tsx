import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ChevronRight, MessageSquare, UserRound } from "lucide-react";

import { getConversas } from "@/lib/supabase/chat";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { cn } from "@/lib/utils";

export default async function ChatPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const conversas = await getConversas(perfil);
  const voltar = perfil.role === "professor" ? "/dashboard" : "/home";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-5 pt-5 pb-10 md:pt-10">
      <header className="flex flex-col gap-5">
        <Link
          href={voltar}
          aria-label="Voltar"
          className="flex size-11 items-center justify-center rounded-full bg-card text-neutral-600 ring-1 ring-neutral-200/90 transition-colors hover:text-neutral-950"
        >
          <ArrowLeft className="size-5" strokeWidth={1.9} aria-hidden />
        </Link>
        <div>
          <p className="rotulo text-primary">Mensagens</p>
          <h1 className="mt-1.5 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-neutral-950 md:text-[34px]">
            Conversas
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
            {perfil.role === "professor"
              ? "Fale direto com cada aluno."
              : "Fale direto com quem cuida do seu treino."}
          </p>
        </div>
      </header>

      {conversas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
          <MessageSquare className="size-7 text-neutral-400" strokeWidth={1.8} aria-hidden />
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-neutral-950">
            Ninguém para conversar ainda
          </p>
          <p className="max-w-xs text-[15px] leading-relaxed text-neutral-500">
            {perfil.role === "professor"
              ? "Assim que houver alunos cadastrados, eles aparecem aqui."
              : "Assim que o centro cadastrar seu professor, ele aparece aqui."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
          {conversas.map(({ contato, ultimaMensagem, naoLidas }) => (
            <li key={contato.id}>
              <Link
                href={`/chat/${contato.id}`}
                className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-neutral-50 md:px-5"
              >
                <span className="numero flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-grafite text-base font-semibold text-white">
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
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[15px] font-semibold text-neutral-950">
                      {contato.nome}
                    </p>
                    {ultimaMensagem && (
                      <span className="shrink-0 text-xs text-neutral-400">
                        {formatDistanceToNow(
                          new Date(ultimaMensagem.created_at),
                          { addSuffix: true, locale: ptBR }
                        )}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        naoLidas > 0 ? "font-medium text-neutral-800" : "text-neutral-500"
                      )}
                    >
                      {ultimaMensagem?.texto ?? "Nenhuma mensagem ainda"}
                    </p>
                    {naoLidas > 0 ? (
                      <span className="numero flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ciano px-1.5 text-xs font-semibold text-grafite">
                        {naoLidas}
                      </span>
                    ) : (
                      <ChevronRight
                        className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
