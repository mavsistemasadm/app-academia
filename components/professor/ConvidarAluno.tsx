"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle2, Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConvitePendente } from "@/lib/supabase/convites";
import type { AvatarCondicao } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AVATAR_OPCOES } from "@/lib/utils/avatares";

const CARD = "flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6";
const TITULO_SECAO = "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";

/** (11) 98888-7777 — mesmo formato do cadastro. */
function formatarTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

async function enviarConvite(corpo: {
  nome: string;
  email: string;
  telefone?: string;
  avatar_condicao?: AvatarCondicao[];
}): Promise<{ ok: true; reenviado: boolean } | { ok: false; erro: string }> {
  try {
    const resposta = await fetch("/api/convites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      return {
        ok: false,
        erro: json.erro ?? "Não foi possível enviar o convite. Tente novamente.",
      };
    }
    return { ok: true, reenviado: Boolean(json.reenviado) };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Verifique sua internet." };
  }
}

interface ConvidarAlunoProps {
  pendentes: ConvitePendente[];
  erroPendentes?: boolean;
}

export function ConvidarAluno({ pendentes, erroPendentes }: ConvidarAlunoProps) {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [condicoes, setCondicoes] = useState<AvatarCondicao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ email: string; reenviado: boolean } | null>(
    null
  );

  const [reenviando, setReenviando] = useState<string | null>(null);
  const [avisoLista, setAvisoLista] = useState<{ id: string; texto: string; erro: boolean } | null>(
    null
  );

  function alternarCondicao(valor: AvatarCondicao) {
    setCondicoes((atual) =>
      atual.includes(valor) ? atual.filter((c) => c !== valor) : [...atual, valor]
    );
  }

  function convidarOutro() {
    setNome("");
    setEmail("");
    setTelefone("");
    setCondicoes([]);
    setErro(null);
    setEnviado(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (nome.trim().length < 2) {
      setErro("Informe o nome do aluno.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setErro("E-mail inválido. Confira o endereço digitado.");
      return;
    }

    setEnviando(true);
    const resultado = await enviarConvite({
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone || undefined,
      avatar_condicao: condicoes.length ? condicoes : undefined,
    });
    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }

    setEnviado({ email: email.trim().toLowerCase(), reenviado: resultado.reenviado });
    router.refresh();
  }

  async function reenviar(convite: ConvitePendente) {
    setReenviando(convite.id);
    setAvisoLista(null);

    const resultado = await enviarConvite({ nome: convite.nome, email: convite.email });
    setReenviando(null);

    setAvisoLista(
      resultado.ok
        ? { id: convite.id, texto: "Convite reenviado.", erro: false }
        : { id: convite.id, texto: resultado.erro, erro: true }
    );
    if (resultado.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <section className={cn(CARD, "max-w-2xl")}>
        {enviado ? (
          <div className="flex flex-col gap-5" role="status">
            <CheckCircle2 className="size-8 text-saude-verde" strokeWidth={1.8} aria-hidden />
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
                {enviado.reenviado ? "Convite reenviado" : "Convite enviado"}
              </h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-500">
                {enviado.reenviado ? "Convite reenviado para " : "Convite enviado para "}
                <span className="font-medium text-neutral-900">{enviado.email}</span>. Ele
                recebe um e-mail para criar a senha.
              </p>
              {enviado.reenviado && (
                <p className="mt-2 text-sm text-neutral-500">
                  Esse e-mail já tinha sido convidado e ainda não entrou, então mandamos um
                  link novo.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="escuro"
              onClick={convidarOutro}
              className="h-12 w-full rounded-full text-base font-semibold active:scale-[.98] sm:w-auto sm:px-8"
            >
              Convidar outro aluno
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
              Dados do aluno
            </h2>

            <div className="flex flex-col gap-2">
              <Label htmlFor="convite-nome" className="text-neutral-700">
                Nome
              </Label>
              <Input
                id="convite-nome"
                autoComplete="off"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={enviando}
                className="h-12 rounded-[14px] px-4 text-base"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="convite-email" className="text-neutral-700">
                  E-mail
                </Label>
                <Input
                  id="convite-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="off"
                  placeholder="aluno@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={enviando}
                  className="h-12 rounded-[14px] px-4 text-base"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="convite-telefone" className="text-neutral-700">
                  Telefone <span className="font-normal text-neutral-400">(opcional)</span>
                </Label>
                <Input
                  id="convite-telefone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="(11) 98888-7777"
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                  disabled={enviando}
                  className="h-12 rounded-[14px] px-4 text-base"
                />
              </div>
            </div>

            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-sm font-medium text-neutral-700">
                Condições clínicas{" "}
                <span className="font-normal text-neutral-400">(o aluno pode ajustar depois)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {AVATAR_OPCOES.map((opcao) => {
                  const marcada = condicoes.includes(opcao.value);
                  return (
                    <button
                      key={opcao.value}
                      type="button"
                      onClick={() => alternarCondicao(opcao.value)}
                      aria-pressed={marcada}
                      title={opcao.descricao}
                      disabled={enviando}
                      className={cn(
                        "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                        marcada
                          ? "bg-grafite text-white"
                          : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100",
                        enviando && "opacity-60"
                      )}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {opcao.emoji}
                      </span>
                      {opcao.label}
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
          <h2 className={TITULO_SECAO}>Convites pendentes</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Quem foi convidado e ainda não clicou no link do e-mail.
          </p>
        </div>

        {erroPendentes ? (
          <p className="text-sm text-saude-vermelho">
            Não foi possível carregar os convites. Recarregue a página em instantes.
          </p>
        ) : pendentes.length === 0 ? (
          <p className="rounded-2xl bg-card px-5 py-4 text-[15px] text-neutral-500 ring-1 ring-neutral-200/90">
            Nenhum convite esperando resposta. Quem aceitou já aparece na lista de alunos.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-2xl bg-card ring-1 ring-neutral-200/90">
            {pendentes.map((convite) => {
              const aviso = avisoLista?.id === convite.id ? avisoLista : null;
              return (
                <li
                  key={convite.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-950">{convite.nome}</p>
                    <p className="truncate text-sm text-neutral-500">{convite.email}</p>
                    <p className="rotulo mt-1 text-neutral-400" suppressHydrationWarning>
                      Convidado{" "}
                      {formatDistanceToNow(new Date(convite.convidadoEm), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                    {aviso && (
                      <p
                        role={aviso.erro ? "alert" : "status"}
                        className={cn(
                          "mt-1.5 text-sm",
                          aviso.erro ? "text-saude-vermelho" : "text-saude-verde"
                        )}
                      >
                        {aviso.texto}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reenviar(convite)}
                    disabled={reenviando !== null}
                    className="h-10 rounded-full px-4 text-sm font-medium active:scale-[.98]"
                  >
                    {reenviando === convite.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <RotateCw className="size-4" strokeWidth={1.8} aria-hidden />
                    )}
                    Reenviar
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
