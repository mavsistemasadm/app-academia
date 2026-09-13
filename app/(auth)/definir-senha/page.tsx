"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, MailWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { traduzirErroAuth } from "@/lib/utils/erros-auth";

const SENHA_MINIMA = 8;

type Estado = "verificando" | "sem-sessao" | "pronto";

/**
 * Primeira senha do aluno convidado. Chega-se aqui pelo link do convite, por
 * dois caminhos:
 *
 * - `token_hash` (template personalizado): `/auth/confirmar` já criou a
 *   sessão nos cookies.
 * - `{{ .ConfirmationURL }}` (padrão): o convite não usa PKCE, então a sessão
 *   vem no `#access_token` da URL. O servidor não enxerga o fragmento; quem o
 *   lê é o cliente do Supabase ao iniciar, logo abaixo.
 *
 * O middleware deixa esta rota abrir com ou sem sessão — sem sessão é o link
 * expirado, e a tela explica o que fazer.
 */
export default function DefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();

  const [estado, setEstado] = useState<Estado>("verificando");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let ativo = true;

    // Link vencido ou já usado: o Supabase devolve o erro no fragmento (ou na
    // query). Não aproveitar uma sessão antiga que esteja no navegador.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const linkComErro = Boolean(
      hash.get("error") || hash.get("error_code") || query.get("error")
    );

    async function verificar() {
      if (linkComErro) {
        if (ativo) setEstado("sem-sessao");
        return;
      }

      // getUser espera o cliente terminar de ler o #access_token, se houver.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!ativo) return;

      if (!user) {
        setEstado("sem-sessao");
        return;
      }

      const nomeCompleto =
        typeof user.user_metadata?.nome === "string" ? user.user_metadata.nome : "";
      setNome(nomeCompleto.trim().split(/\s+/)[0] ?? "");
      setEstado("pronto");

      // Tira o token da barra de endereço.
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    verificar();
    return () => {
      ativo = false;
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter no mínimo ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setErro(traduzirErroAuth(error.message));
      setCarregando(false);
      return;
    }

    router.replace("/home");
    router.refresh();
  }

  if (estado === "verificando") {
    return (
      <Card className="[--card-spacing:--spacing(6)]">
        <CardContent>
          <div className="flex items-center gap-3 py-6 text-sm text-neutral-500" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Abrindo seu convite...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (estado === "sem-sessao") {
    return (
      <Card className="[--card-spacing:--spacing(6)]">
        <CardContent>
          <div className="flex flex-col gap-5">
            <MailWarning className="size-8 text-saude-amarelo" strokeWidth={1.8} aria-hidden />
            <div>
              <p className="text-xl font-semibold tracking-tight text-neutral-900">
                Esse link não vale mais
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                O convite expirou ou já foi usado. Peça ao seu professor para reenviar o
                convite. Chega um e-mail novo em poucos minutos.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                Se você já criou sua senha, é só entrar.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-white transition-all duration-200 active:scale-[.98]"
            >
              Ir para o login
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div>
            <p className="text-xl font-semibold tracking-tight text-neutral-900">
              Bem-vindo(a) à Atitude Vital{nome ? `, ${nome}` : ""}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Crie sua senha para entrar no app. Ela vale para os próximos acessos.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="senha" className="text-neutral-700">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="senha"
                name="senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                placeholder={`Mínimo ${SENHA_MINIMA} caracteres`}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                disabled={carregando}
                className="h-12 rounded-[14px] px-4 pr-12 text-base"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600"
              >
                {mostrarSenha ? (
                  <EyeOff className="size-5" aria-hidden />
                ) : (
                  <Eye className="size-5" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmacao" className="text-neutral-700">
              Repita a senha
            </Label>
            <Input
              id="confirmacao"
              name="confirmacao"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
              disabled={carregando}
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
            disabled={carregando}
            className="h-12 w-full rounded-full text-base font-semibold"
          >
            {carregando ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Salvando...
              </>
            ) : (
              "Criar senha e entrar"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
