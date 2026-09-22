"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MembroEquipe } from "@/lib/supabase/equipe";
import { cn } from "@/lib/utils";

const CARD = "flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6";
const TITULO_SECAO = "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";

const PAPEIS = [
  {
    admin: false,
    label: "Professor",
    descricao: "Cuida dos alunos: treinos, alertas, aulas e agenda.",
  },
  {
    admin: true,
    label: "Admin",
    descricao: "Tudo do professor e ainda convida e gerencia a equipe.",
  },
] as const;

type Situacao = "convidado" | "reenviado" | "promovido";

const TEXTO_SITUACAO: Record<Situacao, { titulo: string; corpo: string }> = {
  convidado: {
    titulo: "Convite enviado",
    corpo: "Chega um e-mail para criar a senha e entrar direto no painel.",
  },
  reenviado: {
    titulo: "Convite reenviado",
    corpo: "Esse e-mail já tinha sido convidado e ainda não entrou, então mandamos um link novo.",
  },
  promovido: {
    titulo: "Acesso liberado",
    corpo: "Esse e-mail já tinha conta de aluno. Agora a conta abre no painel do professor.",
  },
};

async function chamar(
  metodo: "POST" | "PATCH",
  corpo: object
): Promise<{ ok: true; situacao?: Situacao } | { ok: false; erro: string }> {
  try {
    const resposta = await fetch("/api/equipe", {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      return { ok: false, erro: json.erro ?? "Não foi possível salvar. Tente novamente." };
    }
    return { ok: true, situacao: json.situacao };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Verifique sua internet." };
  }
}

interface GerenciarEquipeProps {
  meuId: string;
  membros: MembroEquipe[];
  erroLista?: boolean;
}

export function GerenciarEquipe({ meuId, membros, erroLista }: GerenciarEquipeProps) {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ email: string; situacao: Situacao } | null>(null);

  const [salvando, setSalvando] = useState<string | null>(null);
  const [avisoLista, setAvisoLista] = useState<{ id: string; texto: string } | null>(null);

  function convidarOutro() {
    setNome("");
    setEmail("");
    setAdmin(false);
    setErro(null);
    setEnviado(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (nome.trim().length < 2) {
      setErro("Informe o nome.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setErro("E-mail inválido. Confira o endereço digitado.");
      return;
    }

    setEnviando(true);
    const resultado = await chamar("POST", { nome: nome.trim(), email: email.trim(), admin });
    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }

    setEnviado({
      email: email.trim().toLowerCase(),
      situacao: resultado.situacao ?? "convidado",
    });
    router.refresh();
  }

  async function alternarAdmin(membro: MembroEquipe) {
    setSalvando(membro.id);
    setAvisoLista(null);

    const resultado = await chamar("PATCH", { id: membro.id, admin: !membro.ehAdmin });
    setSalvando(null);

    if (!resultado.ok) {
      setAvisoLista({ id: membro.id, texto: resultado.erro });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <section className={cn(CARD, "max-w-2xl")}>
        {enviado ? (
          <div className="flex flex-col gap-5" role="status">
            <CheckCircle2 className="size-8 text-saude-verde" strokeWidth={1.8} aria-hidden />
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
                {TEXTO_SITUACAO[enviado.situacao].titulo}
              </h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-500">
                <span className="font-medium text-neutral-900">{enviado.email}</span>.{" "}
                {TEXTO_SITUACAO[enviado.situacao].corpo}
              </p>
            </div>
            <Button
              type="button"
              variant="escuro"
              onClick={convidarOutro}
              className="h-12 w-full rounded-full text-base font-semibold active:scale-[.98] sm:w-auto sm:px-8"
            >
              Convidar outra pessoa
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
              Convidar para a equipe
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="equipe-nome" className="text-neutral-700">
                  Nome
                </Label>
                <Input
                  id="equipe-nome"
                  autoComplete="off"
                  placeholder="Nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={enviando}
                  className="h-12 rounded-[14px] px-4 text-base"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="equipe-email" className="text-neutral-700">
                  E-mail
                </Label>
                <Input
                  id="equipe-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="off"
                  placeholder="professor@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={enviando}
                  className="h-12 rounded-[14px] px-4 text-base"
                />
              </div>
            </div>

            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-sm font-medium text-neutral-700">Acesso</legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {PAPEIS.map((papel) => {
                  const marcado = admin === papel.admin;
                  return (
                    <button
                      key={papel.label}
                      type="button"
                      onClick={() => setAdmin(papel.admin)}
                      aria-pressed={marcado}
                      disabled={enviando}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 active:scale-[.98]",
                        marcado
                          ? "bg-grafite text-white"
                          : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100",
                        enviando && "opacity-60"
                      )}
                    >
                      <span className="text-[15px] font-semibold">{papel.label}</span>
                      <span
                        className={cn(
                          "text-sm leading-snug",
                          marcado ? "text-neutral-300" : "text-neutral-500"
                        )}
                      >
                        {papel.descricao}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {erro && (
              <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {erro}
              </p>
            )}

            <Button
              type="submit"
              disabled={enviando}
              className="h-12 w-full rounded-full text-base font-semibold active:scale-[.98] sm:w-auto sm:self-start sm:px-8"
            >
              {enviando ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  Enviando...
                </>
              ) : (
                "Enviar convite"
              )}
            </Button>
          </form>
        )}
      </section>

      <section className="flex max-w-2xl flex-col gap-3.5">
        <div>
          <h2 className={TITULO_SECAO}>Quem está na equipe</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Admin convida e gerencia a equipe. A equipe sempre fica com pelo menos um.
          </p>
        </div>

        {erroLista ? (
          <p className="text-sm text-saude-vermelho">
            Não foi possível carregar a equipe. Recarregue a página em instantes.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-2xl bg-card ring-1 ring-neutral-200/90">
            {membros.map((membro) => {
              const souEu = membro.id === meuId;
              const aviso = avisoLista?.id === membro.id ? avisoLista.texto : null;
              return (
                <li
                  key={membro.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-neutral-950">
                      <span className="truncate">{membro.nome}</span>
                      {souEu && <span className="text-sm font-normal text-neutral-400">você</span>}
                      {membro.ehAdmin && (
                        <span className="rotulo rounded-full bg-grafite px-2 py-0.5 text-white">
                          Admin
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-neutral-500">{membro.email}</p>
                    {membro.pendente && membro.convidadoEm && (
                      <p className="rotulo mt-1 text-neutral-400" suppressHydrationWarning>
                        Convite pendente, enviado{" "}
                        {formatDistanceToNow(new Date(membro.convidadoEm), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    )}
                    {aviso && (
                      <p role="alert" className="mt-1.5 text-sm text-saude-vermelho">
                        {aviso}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => alternarAdmin(membro)}
                    disabled={salvando !== null}
                    className="h-10 rounded-full px-4 text-sm font-medium active:scale-[.98]"
                  >
                    {salvando === membro.id && (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    )}
                    {membro.ehAdmin ? "Tirar admin" : "Tornar admin"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
