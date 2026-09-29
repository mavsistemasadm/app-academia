"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CARD = "flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6";

async function chamar(
  metodo: "PATCH" | "DELETE",
  corpo: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const resposta = await fetch("/api/alunos", {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok) return { ok: false, erro: json.erro ?? "Não foi possível salvar. Tente de novo." };
    return { ok: true };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Verifique sua internet." };
  }
}

/**
 * Fim da ficha, só para admin: inativar (volta quando quiser) ou excluir de
 * vez. Excluir pede o nome completo digitado, porque não tem volta.
 */
export function ContaDoAluno({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  const router = useRouter();
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? nome;

  const [salvando, setSalvando] = useState<"ativo" | "excluir" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrirExclusao, setAbrirExclusao] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  const nomeConfere =
    confirmacao.trim().replace(/\s+/g, " ").toLowerCase() ===
    nome.trim().replace(/\s+/g, " ").toLowerCase();

  async function alternarAtivo() {
    if (ativo) {
      const certeza = window.confirm(
        `Inativar ${primeiroNome}? A conta deixa de entrar no app e some das listas, ` +
          "dos lembretes e dos alertas. O histórico fica guardado e dá para reativar aqui mesmo."
      );
      if (!certeza) return;
    }

    setSalvando("ativo");
    setErro(null);
    const resultado = await chamar("PATCH", { id, ativo: !ativo });
    setSalvando(null);

    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    router.refresh();
  }

  async function excluir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nomeConfere) return;

    setSalvando("excluir");
    setErro(null);
    const resultado = await chamar("DELETE", { id, nome: confirmacao });

    if (!resultado.ok) {
      setSalvando(null);
      setErro(resultado.erro);
      return;
    }
    router.replace("/alunos");
    router.refresh();
  }

  return (
    <section className={cn(CARD, "max-w-2xl")} aria-labelledby="conta-aluno">
      <div>
        <h2
          id="conta-aluno"
          className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl"
        >
          Conta do aluno
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-500">
          {ativo
            ? "Aluno que parou de treinar: inative. Ele não entra mais no app, sai das listas e o histórico fica guardado para quando voltar."
            : `${primeiroNome} está inativo: não entra no app nem aparece nas listas. Reative para devolver o acesso com todo o histórico.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={ativo ? "outline" : "escuro"}
          onClick={alternarAtivo}
          disabled={salvando !== null}
          className="h-11 rounded-full px-5 text-sm font-semibold active:scale-[.98]"
        >
          {salvando === "ativo" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {ativo ? "Inativar aluno" : "Reativar aluno"}
        </Button>

        {!abrirExclusao && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAbrirExclusao(true)}
            disabled={salvando !== null}
            className="h-11 rounded-full px-5 text-sm font-semibold text-saude-vermelho hover:bg-saude-vermelho/5 hover:text-saude-vermelho"
          >
            Excluir definitivamente
          </Button>
        )}
      </div>

      {abrirExclusao && (
        <form
          onSubmit={excluir}
          className="flex flex-col gap-4 rounded-xl bg-saude-vermelho/[.04] p-4 ring-1 ring-saude-vermelho/25"
          noValidate
        >
          <p className="text-sm leading-relaxed text-neutral-700">
            Apaga a conta e tudo o que é de {primeiroNome}: indicadores, treinos,
            medicamentos, humor, conversas, exames e fotos.{" "}
            <span className="font-semibold text-neutral-950">Não tem como desfazer.</span>{" "}
            Se a ideia é só tirar da lista, inative.
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmar-exclusao" className="text-neutral-700">
              Para confirmar, digite o nome completo:{" "}
              <span className="font-semibold text-neutral-950">{nome}</span>
            </Label>
            <Input
              id="confirmar-exclusao"
              autoComplete="off"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={salvando !== null}
              className="h-12 rounded-[14px] px-4 text-base"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={!nomeConfere || salvando !== null}
              className="h-11 rounded-full bg-saude-vermelho px-5 text-sm font-semibold text-white hover:bg-saude-vermelho/90"
            >
              {salvando === "excluir" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Excluir para sempre
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAbrirExclusao(false);
                setConfirmacao("");
              }}
              disabled={salvando !== null}
              className="h-11 rounded-full px-5 text-sm font-semibold"
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {erro && (
        <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}
    </section>
  );
}
