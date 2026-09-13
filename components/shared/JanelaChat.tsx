"use client";

import { useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Send } from "lucide-react";

import type { Mensagem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

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
      setErro("Não conseguimos enviar. Tente de novo.");
      return;
    }

    setMensagens((atuais) => [...atuais, data as Mensagem]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {mensagens.length === 0 ? (
          <p className="my-auto text-center text-sm text-neutral-500">
            Nenhuma mensagem ainda. Escreva para {contatoNome.split(" ")[0]}.
          </p>
        ) : (
          mensagens.map((mensagem, indice) => {
            const minha = mensagem.de === meuId;
            const anterior = mensagens[indice - 1];

            const novoDia =
              !anterior ||
              !isSameDay(
                new Date(anterior.created_at),
                new Date(mensagem.created_at)
              );

            return (
              <div key={mensagem.id} className="flex flex-col gap-2">
                {novoDia && (
                  <p className="my-2 text-center text-xs text-neutral-400">
                    {format(new Date(mensagem.created_at), "dd 'de' MMMM", {
                      locale: ptBR,
                    })}
                  </p>
                )}

                <div
                  className={cn(
                    "flex max-w-[80%] flex-col gap-0.5 rounded-2xl px-3.5 py-2.5",
                    minha
                      ? "self-end rounded-br-md bg-primary text-white"
                      : "self-start rounded-bl-md bg-white text-neutral-900 ring-1 ring-neutral-200"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{mensagem.texto}</p>
                  <p
                    className={cn(
                      "text-right text-[11px]",
                      minha ? "text-white/70" : "text-neutral-400"
                    )}
                  >
                    {format(new Date(mensagem.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={fim} />
      </div>

      <form
        onSubmit={enviar}
        className="flex items-end gap-2 border-t border-neutral-200 bg-white px-4 py-3"
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
          className="max-h-32 min-h-12 flex-1 resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />

        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          aria-label="Enviar mensagem"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-opacity disabled:opacity-40"
        >
          {enviando ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Send className="size-5" aria-hidden />
          )}
        </button>
      </form>

      {erro && (
        <p role="alert" className="px-4 pb-2 text-sm text-saude-vermelho">
          {erro}
        </p>
      )}
    </div>
  );
}
