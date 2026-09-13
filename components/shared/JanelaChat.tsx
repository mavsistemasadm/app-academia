"use client";

import { useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUp, Loader2, MessageSquare } from "lucide-react";

import type { Mensagem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { naAcademia } from "@/lib/utils/datas";

interface JanelaChatProps {
  meuId: string;
  contatoId: string;
  contatoNome: string;
  mensagensIniciais: Mensagem[];
}

export function JanelaChat({
  meuId,
  contatoId,
  contatoNome,
  mensagensIniciais,
}: JanelaChatProps) {
  const [mensagens, setMensagens] = useState(mensagensIniciais);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  useEffect(() => {
    const supabase = createClient();

    const canal = supabase
      .channel(`chat:${[meuId, contatoId].sort().join(":")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `para=eq.${meuId}`,
        },
        ({ new: nova }) => {
          const mensagem = nova as Mensagem;
          // O filtro do realtime só pega o destinatário; confere o remetente.
          if (mensagem.de !== contatoId) return;

          setMensagens((atuais) =>
            atuais.some((m) => m.id === mensagem.id)
              ? atuais
              : [...atuais, mensagem]
          );

          supabase
            .from("mensagens")
            .update({ lida: true })
            .eq("id", mensagem.id)
            .then();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [meuId, contatoId]);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    setEnviando(true);
    setErro(null);
    setTexto("");

    const { data, error } = await createClient()
      .from("mensagens")
      .insert({ de: meuId, para: contatoId, texto: conteudo })
      .select("*")
      .single();

    setEnviando(false);

    if (error || !data) {
      setTexto(conteudo);
      setErro("Não conseguimos enviar. Confira a conexão e tente de novo.");
      return;
    }

    setMensagens((atuais) => [...atuais, data as Mensagem]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-5">
        {mensagens.length === 0 ? (
          <div className="my-auto flex flex-col items-center gap-2 px-6 text-center">
            <MessageSquare className="size-7 text-neutral-400" strokeWidth={1.8} aria-hidden />
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-neutral-950">
              Comece a conversa
            </p>
            <p className="max-w-xs text-[15px] leading-relaxed text-neutral-500">
              Escreva para {contatoNome.split(" ")[0]}. A mensagem chega na hora.
            </p>
          </div>
        ) : (
          mensagens.map((mensagem, indice) => {
            const minha = mensagem.de === meuId;
            const anterior = mensagens[indice - 1];

            const novoDia =
              !anterior ||
              !isSameDay(
                naAcademia(anterior.created_at),
                naAcademia(mensagem.created_at)
              );

            return (
              <div key={mensagem.id} className="flex flex-col gap-1.5">
                {novoDia && (
                  <p className="my-3 self-center rounded-full bg-card px-3 py-1 ring-1 ring-neutral-200/90">
                    <span className="rotulo text-neutral-400">
                      {format(naAcademia(mensagem.created_at), "dd 'de' MMMM", {
                        locale: ptBR,
                      })}
                    </span>
                  </p>
                )}

                <div
                  className={cn(
                    "flex max-w-[82%] flex-col gap-1 rounded-[20px] px-4 py-2.5",
                    minha
                      ? "self-end rounded-br-md bg-grafite text-white"
                      : "self-start rounded-bl-md bg-card text-neutral-950 ring-1 ring-neutral-200/90"
                  )}
                >
                  <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                    {mensagem.texto}
                  </p>
                  <p
                    className={cn(
                      "text-right font-mono text-[11px] tabular-nums",
                      minha ? "text-white/50" : "text-neutral-400"
                    )}
                  >
                    {format(naAcademia(mensagem.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={fim} />
      </div>

      <div className="sticky bottom-0 border-t border-neutral-200/80 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <form
          onSubmit={enviar}
          className="mx-auto flex w-full max-w-2xl items-end gap-2 px-4 py-3"
        >
          <textarea
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra linha.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Escreva sua mensagem"
            aria-label="Mensagem"
            className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-[24px] bg-card px-5 py-3 text-base text-neutral-950 ring-1 ring-neutral-200/90 outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-ciano/60"
          />

          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            aria-label="Enviar mensagem"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ciano text-grafite transition-all duration-200 hover:bg-[#2cc4d8] active:scale-[.96] disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {enviando ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="size-5" strokeWidth={2.4} aria-hidden />
            )}
          </button>
        </form>

        {erro && (
          <p role="alert" className="mx-auto w-full max-w-2xl px-5 pb-3 text-sm text-saude-vermelho">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
