"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type MinhaSituacao = "participando" | "convidado" | "fora" | "saiu";

/**
 * Entrar, aceitar o convite ou sair. A RLS da 013 só deixa o aluno mexer na
 * própria linha, e entrar sozinho só vale em desafio aberto e no prazo.
 */
export function BotaoParticiparDesafio({
  desafioId,
  alunoId,
  minhaSituacao,
  encerrado,
}: {
  desafioId: string;
  alunoId: string;
  minhaSituacao: MinhaSituacao;
  encerrado: boolean;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  async function mudar(para: "ativo" | "saiu") {
    setErro(null);
    setSalvando(true);

    const supabase = createClient();
    const { error } =
      minhaSituacao === "fora"
        ? await supabase
            .from("desafio_participantes")
            .insert({ desafio_id: desafioId, aluno_id: alunoId, status: "ativo" })
        : await supabase
            .from("desafio_participantes")
            .update({ status: para })
            .eq("desafio_id", desafioId)
            .eq("aluno_id", alunoId);

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos salvar agora. Tente de novo.");
      return;
    }

    iniciarTransicao(() => router.refresh());
  }

  if (encerrado && minhaSituacao !== "participando") return null;

  return (
    <div className="flex flex-col gap-2">
      {minhaSituacao === "participando" ? (
        !encerrado && (
          <button
            type="button"
            onClick={() => mudar("saiu")}
            disabled={salvando}
            className="flex h-11 w-fit items-center gap-2 rounded-full px-4 text-sm font-medium text-neutral-500 ring-1 ring-neutral-200 transition-colors hover:text-neutral-950 disabled:opacity-60"
          >
            {salvando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <LogOut className="size-4" aria-hidden />
            )}
            Sair do desafio
          </button>
        )
      ) : (
        <Button
          type="button"
          variant={minhaSituacao === "convidado" ? "default" : "escuro"}
          onClick={() => mudar("ativo")}
          disabled={salvando}
          className="h-12 w-full rounded-full text-base font-semibold sm:w-auto sm:px-7"
        >
          {salvando ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : minhaSituacao === "convidado" ? (
            <Check className="size-5" aria-hidden />
          ) : (
            <Trophy className="size-5" aria-hidden />
          )}
          {minhaSituacao === "convidado" ? "Aceitar o convite" : "Entrar no desafio"}
        </Button>
      )}

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}
    </div>
  );
}
