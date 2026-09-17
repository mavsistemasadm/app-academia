"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Loader2, Plus, Send, X } from "lucide-react";

import { CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
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
import { cn } from "@/lib/utils";
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
  pendente: { texto: "Aguardando aceite", cor: CHIP_SEMAFORO.amarelo },
  ativo: { texto: "Acompanhando", cor: CHIP_SEMAFORO.verde },
  revogado: { texto: "Acesso removido", cor: "bg-neutral-100 text-neutral-500" },
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

  function mensagemConvite(familiar: FamiliarAcesso) {
    const link = `${window.location.origin}/familia?codigo=${familiar.codigo}`;
    return (
      `Oi, ${familiar.nome.split(" ")[0]}! Quero que você acompanhe minha saúde pelo app da Atitude Vital. ` +
      `Abra o link, crie seu acesso com o e-mail ${familiar.email} e pronto: ${link} ` +
      `(código ${familiar.codigo})`
    );
  }

  async function copiar(familiar: FamiliarAcesso) {
    try {
      await navigator.clipboard.writeText(mensagemConvite(familiar));
      setCopiado(familiar.codigo);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Sem permissão de área de transferência: o código continua à vista.
    }
  }

  async function enviar(familiar: FamiliarAcesso) {
    if (typeof navigator.share !== "function") return copiar(familiar);
    try {
      await navigator.share({ title: "Acompanhe minha saúde", text: mensagemConvite(familiar) });
    } catch (e) {
      // Fechar a folha de compartilhamento não é erro.
      if ((e as DOMException)?.name !== "AbortError") await copiar(familiar);
    }
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* ── Vínculos ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Quem acompanha você
          </h2>
          <Button
            type="button"
            variant="escuro"
            onClick={() => setConvidando(true)}
            className="h-12 rounded-full px-5 text-[15px]"
          >
            <Plus className="size-5" aria-hidden />
            Convidar familiar
          </Button>
        </div>

        {familiares.length === 0 ? (
          <div className="rounded-2xl bg-card px-5 py-6 ring-1 ring-neutral-200/90">
            <p className="text-[15px] font-medium text-neutral-950">
              Ninguém convidado ainda
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
              Gere um convite e mande para um filho, cônjuge ou cuidador.
              Ele cria um acesso só de acompanhante, sem precisar ser aluno.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
            {familiares.map((familiar) => {
              const rotulo = ROTULO_STATUS[familiar.status];

              return (
                <li key={familiar.id} className="flex flex-col gap-4 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-neutral-950">
                        {familiar.nome}
                        {familiar.parentesco && (
                          <span className="font-normal text-neutral-500">
                            {" "}
                            · {familiar.parentesco}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-neutral-500">
                        {familiar.email}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        rotulo.cor
                      )}
                    >
                      {rotulo.texto}
                    </span>
                  </div>

                  {familiar.status === "pendente" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="rotulo text-neutral-400">Código do convite</p>
                        <p className="numero mt-1 text-[28px] leading-none font-semibold tracking-[0.22em] text-neutral-950">
                          {familiar.codigo}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => copiar(familiar)}
                          aria-label="Copiar convite"
                          className="flex h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition-all duration-200 hover:text-neutral-950 active:scale-[.98]"
                        >
                          {copiado === familiar.codigo ? (
                            <>
                              <Check className="size-4 text-saude-verde" aria-hidden />
                              Copiado
                            </>
                          ) : (
                            <Copy className="size-4" aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => enviar(familiar)}
                          className="flex h-11 items-center gap-2 rounded-full bg-grafite px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98]"
                        >
                          <Send className="size-4" aria-hidden />
                          Enviar convite
                        </button>
                      </div>
                      <p className="w-full text-[13px] leading-relaxed text-neutral-500">
                        O convite leva um link. Quem recebe cria o acesso com o
                        e-mail {familiar.email} e já passa a acompanhar você. Se a
                        pessoa já usa o app, é só digitar o código em Acompanhar
                        um familiar.
                      </p>
                    </div>
                  )}

                  {familiar.status === "ativo" && (
                    <button
                      type="button"
                      onClick={() => alterarStatus(familiar, "revogado")}
                      className="w-fit text-sm font-medium text-saude-vermelho underline-offset-4 hover:underline"
                    >
                      Remover acesso
                    </button>
                  )}
                  {familiar.status === "revogado" && familiar.familiar_id && (
                    <button
                      type="button"
                      onClick={() => alterarStatus(familiar, "ativo")}
                      className="w-fit text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Devolver acesso
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── O que o familiar vê ──────────────────────────────────── */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
          O que o familiar vê
        </h2>
        <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card text-[15px] ring-1 ring-neutral-200/90">
          <li className="flex items-center gap-3 px-5 py-3.5 text-neutral-700">
            <Check className="size-5 shrink-0 text-saude-verde" strokeWidth={1.8} aria-hidden />
            Seus indicadores de saúde e o semáforo de cada um
          </li>
          <li className="flex items-center gap-3 px-5 py-3.5 text-neutral-700">
            <Check className="size-5 shrink-0 text-saude-verde" strokeWidth={1.8} aria-hidden />
            Sua frequência na academia
          </li>
          <li className="flex items-center gap-3 px-5 py-3.5 text-neutral-500">
            <X className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
            Nada de treino, chat, humor ou anamnese
          </li>
        </ul>
      </section>

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
        <form onSubmit={convidar} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-[-0.02em]">
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
              className="h-12 rounded-[14px] px-4 text-base"
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
              className="h-12 rounded-[14px] px-4 text-base"
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
              className="h-12 rounded-[14px] px-4 text-base"
            />
          </div>

          {erro && (
            <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={salvando}
            className="h-12 w-full rounded-full text-base font-semibold"
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
