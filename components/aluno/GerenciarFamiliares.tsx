"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Loader2, Plus, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FamiliarAcesso } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/** Mesmo alfabeto do servidor — sem 0/O e 1/I, que confundem no telefone. */
function gerarCodigo() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => alfabeto[Math.floor(Math.random() * alfabeto.length)]
  ).join("");
}

const ROTULO_STATUS = {
  pendente: { texto: "Aguardando aceite", cor: "text-saude-amarelo" },
  ativo: { texto: "Acompanhando", cor: "text-saude-verde" },
  revogado: { texto: "Acesso removido", cor: "text-neutral-400" },
};

interface GerenciarFamiliaresProps {
  alunoId: string;
  familiares: FamiliarAcesso[];
}

export function GerenciarFamiliares({
  alunoId,
  familiares,
}: GerenciarFamiliaresProps) {
  const router = useRouter();
  const [convidando, setConvidando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  async function alterarStatus(
    familiar: FamiliarAcesso,
    status: "ativo" | "revogado"
  ) {
    await createClient()
      .from("familiares_acesso")
      .update({ status })
      .eq("id", familiar.id);

    iniciarTransicao(() => router.refresh());
  }

  async function copiar(codigo: string) {
    await navigator.clipboard.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-bold text-neutral-900">
          O que o familiar vê
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2 text-saude-verde">
            <Check className="size-4 shrink-0" aria-hidden />
            Seus indicadores de saúde e o semáforo de cada um
          </li>
          <li className="flex items-center gap-2 text-saude-verde">
            <Check className="size-4 shrink-0" aria-hidden />
            Sua frequência na academia
          </li>
          <li className="flex items-center gap-2 text-neutral-400">
            <X className="size-4 shrink-0" aria-hidden />
            Nada de treino, chat, humor ou anamnese
          </li>
        </ul>
      </div>

      {familiares.length > 0 && (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {familiares.map((familiar) => {
            const rotulo = ROTULO_STATUS[familiar.status];

            return (
              <li key={familiar.id} className="flex flex-col gap-3 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {familiar.nome}
                      {familiar.parentesco && (
                        <span className="font-normal text-neutral-500">
                          {" "}
                          · {familiar.parentesco}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {familiar.email}
                    </p>
                  </div>

                  <span className={`shrink-0 text-xs font-semibold ${rotulo.cor}`}>
                    {rotulo.texto}
                  </span>
                </div>

                {familiar.status === "pendente" && (
                  <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-neutral-500">
                        Código para o familiar usar no app
                      </p>
                      <p className="text-lg font-bold tracking-widest text-neutral-900 tabular-nums">
                        {familiar.codigo}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => copiar(familiar.codigo)}
                      aria-label="Copiar código"
                    >
                      {copiado === familiar.codigo ? (
                        <Check className="size-4 text-saude-verde" aria-hidden />
                      ) : (
                        <Copy className="size-4" aria-hidden />
                      )}
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  {familiar.status === "ativo" && (
                    <button
                      type="button"
                      onClick={() => alterarStatus(familiar, "revogado")}
                      className="text-sm font-medium text-saude-vermelho underline-offset-4 hover:underline"
                    >
                      Remover acesso
                    </button>
                  )}
                  {familiar.status === "revogado" && familiar.familiar_id && (
                    <button
                      type="button"
                      onClick={() => alterarStatus(familiar, "ativo")}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Devolver acesso
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => setConvidando(true)}
        className="h-12 rounded-xl font-semibold"
      >
        <Plus className="size-5" aria-hidden />
        Convidar familiar
      </Button>

      <DialogConvite
        alunoId={alunoId}
        aberto={convidando}
        onFechar={() => setConvidando(false)}
      />
    </div>
  );
}

function DialogConvite({
  alunoId,
  aberto,
  onFechar,
}: {
  alunoId: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function convidar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (nome.trim().length < 2) return setErro("Diga o nome do familiar.");
    if (!email.includes("@")) return setErro("Informe um e-mail válido.");

    setSalvando(true);

    const { error } = await createClient().from("familiares_acesso").insert({
      aluno_id: alunoId,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      parentesco: parentesco.trim() || null,
      codigo: gerarCodigo(),
      status: "pendente",
    });

    setSalvando(false);

    if (error) {
      setErro(
        error.code === "23505"
          ? "Esse e-mail já foi convidado."
          : "Não conseguimos criar o convite."
      );
      return;
    }

    setNome("");
    setEmail("");
    setParentesco("");
    onFechar();
    router.refresh();
  }

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={convidar} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5" aria-hidden />
              Convidar familiar
            </DialogTitle>
            <DialogDescription>
              Ele vê só seus indicadores e sua frequência. Você pode remover o
              acesso quando quiser.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fam-nome" className="text-neutral-700">
              Nome
            </Label>
            <Input
              id="fam-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Maria da Silva"
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fam-email" className="text-neutral-700">
              E-mail
            </Label>
            <Input
              id="fam-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@email.com"
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fam-parentesco" className="text-neutral-700">
              Parentesco{" "}
              <span className="font-normal text-neutral-400">(opcional)</span>
            </Label>
            <Input
              id="fam-parentesco"
              value={parentesco}
              onChange={(e) => setParentesco(e.target.value)}
              placeholder="Filha, esposo, cuidadora…"
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </div>

          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-saude-vermelho-light px-3.5 py-3 text-sm text-saude-vermelho"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={salvando}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            {salvando ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Criando convite...
              </>
            ) : (
              "Gerar convite"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
