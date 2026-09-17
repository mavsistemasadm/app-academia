"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { CampoAnamnese } from "@/components/shared/CampoAnamnese";
import { Button } from "@/components/ui/button";
import type { Anamnese } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  agruparPorSecao,
  colunasLegadas,
  normalizarResposta,
  respostaDe,
  type PerguntaAnamnese,
  type Resposta,
} from "@/lib/utils/anamnese";

interface FormularioAnamneseProps {
  alunoId: string;
  anamnese: Anamnese | null;
  /** Só as ativas, na ordem do formulário. */
  perguntas: PerguntaAnamnese[];
  /** A migração 011 está no banco: dá para gravar em `respostas`. */
  editavel: boolean;
}

export function FormularioAnamnese({
  alunoId,
  anamnese,
  perguntas,
  editavel,
}: FormularioAnamneseProps) {
  const router = useRouter();

  const [respostas, setRespostas] = useState<Record<string, Resposta | null>>(() =>
    Object.fromEntries(perguntas.map((p) => [p.id, respostaDe(p, anamnese)]))
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [, iniciarTransicao] = useTransition();

  const secoes = agruparPorSecao(perguntas);

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSalvo(false);

    // Número no meio da digitação ("72,") vira número aqui.
    const finais = Object.fromEntries(
      perguntas.map((p) => [p.id, normalizarResposta(p.tipo, respostas[p.id])])
    );

    const faltando = perguntas.find((p) => p.obrigatoria && finais[p.id] === null);
    if (faltando) {
      setErro(`Responda "${faltando.enunciado}". É obrigatória.`);
      document.getElementById(`pergunta-${faltando.id}`)?.focus();
      return;
    }

    setSalvando(true);

    // Respostas de pergunta arquivada ficam: a ficha do professor segue mostrando.
    const gravadas: Record<string, unknown> = { ...(anamnese?.respostas ?? {}) };
    for (const [id, valor] of Object.entries(finais)) {
      if (valor === null) delete gravadas[id];
      else gravadas[id] = valor;
    }

    const { error } = await createClient()
      .from("anamneses")
      .upsert(
        {
          aluno_id: alunoId,
          ...colunasLegadas(perguntas, finais),
          ...(editavel ? { respostas: gravadas } : {}),
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "aluno_id" }
      );

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }

    setSalvo(true);
    iniciarTransicao(() => router.refresh());
  }

  const respondidas = perguntas.filter(
    (p) => normalizarResposta(p.tipo, respostas[p.id]) !== null
  ).length;

  return (
    <form onSubmit={salvar} className="flex flex-col gap-6 md:gap-8" noValidate>
      <div className="flex items-center gap-3" aria-live="polite">
        <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-ciano transition-all duration-200"
            style={{ width: `${perguntas.length ? (respondidas / perguntas.length) * 100 : 0}%` }}
          />
        </div>
        <p className="rotulo shrink-0 text-neutral-400">
          {respondidas} de {perguntas.length} respondidas
        </p>
      </div>

      <p className="-mt-2 text-[15px] leading-relaxed text-neutral-500">
        Deixe em branco o que não se aplica a você.
        {perguntas.some((p) => p.obrigatoria) && (
          <>
            {" "}Só o que tem <span className="text-saude-vermelho">*</span> é obrigatório.
          </>
        )}
      </p>

      {secoes.map(({ secao, perguntas: daSecao }, indice) => (
        <section
          key={secao}
          className="flex flex-col gap-6 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-7"
        >
          <div>
            <p className="rotulo text-neutral-400">
              Parte {indice + 1} de {secoes.length}
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
              {secao}
            </h2>
          </div>

          {daSecao.map((pergunta) => (
            <CampoAnamnese
              key={pergunta.id}
              pergunta={pergunta}
              valor={respostas[pergunta.id] ?? null}
              onMudar={(valor) => setRespostas((atuais) => ({ ...atuais, [pergunta.id]: valor }))}
              desabilitado={salvando}
            />
          ))}
        </section>
      ))}

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
        <Button
          type="submit"
          disabled={salvando}
          className="h-12 w-full rounded-full px-8 text-base font-semibold sm:w-auto"
        >
          {salvando ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Salvando...
            </>
          ) : anamnese ? (
            "Atualizar anamnese"
          ) : (
            "Enviar anamnese"
          )}
        </Button>

        {erro && (
          <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {erro}
          </p>
        )}

        {salvo && !erro && (
          <p role="status" className="flex items-center gap-2 text-sm text-saude-verde">
            <Check className="size-4 shrink-0" aria-hidden />
            Anamnese salva. Seu professor já consegue ver.
          </p>
        )}
      </div>
    </form>
  );
}
