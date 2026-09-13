"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AvatarCondicao } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_OPCOES } from "@/lib/utils/avatares";
import { traduzirErroAuth } from "@/lib/utils/erros-auth";

const SENHA_MINIMA = 6;

/** (11) 98888-7777 — formata enquanto o aluno digita. */
function formatarTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export default function CadastroPage() {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [condicoes, setCondicoes] = useState<AvatarCondicao[]>([]);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  function alternarCondicao(condicao: AvatarCondicao) {
    setCondicoes((atuais) =>
      atuais.includes(condicao)
        ? atuais.filter((c) => c !== condicao)
        : [...atuais, condicao]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (nome.trim().length < 3) {
      setErro("Digite seu nome completo.");
      return;
    }
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter no mínimo ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (condicoes.length === 0) {
      setErro("Selecione ao menos uma condição para personalizarmos seu acompanhamento.");
      return;
    }

    setCarregando(true);

    const telefoneLimpo = telefone.replace(/\D/g, "");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        // O link de confirmação volta por aqui, que troca o código por sessão.
        emailRedirectTo: `${window.location.origin}/auth/confirmar?proximo=/home`,
        // Lidos pelo trigger `handle_new_user` ao criar a linha em `profiles`.
        data: {
          nome: nome.trim(),
          telefone: telefoneLimpo,
          // O trigger lê como array JSON — ver migração 004.
          avatar_condicao: condicoes,
          role: "aluno",
        },
      },
    });

    if (error || !data.user) {
      setErro(traduzirErroAuth(error?.message));
      setCarregando(false);
      return;
    }

    // Com confirmação de e-mail ligada, um e-mail já cadastrado volta como
    // usuário sem identidades em vez de erro.
    if (data.user.identities && data.user.identities.length === 0) {
      setErro("Esse e-mail já tem cadastro. Faça login.");
      setCarregando(false);
      return;
    }

    if (!data.session) {
      // Sem sessão = precisa confirmar o e-mail antes de entrar.
      setAguardandoConfirmacao(true);
      setCarregando(false);
      return;
    }

    // Já autenticado: completa o perfil criado pelo trigger com os campos
    // que ele não preenche, e segue para a home.
    const { error: erroPerfil } = await supabase
      .from("profiles")
      .update({ telefone: telefoneLimpo, avatar_condicao: condicoes })
      .eq("id", data.user.id);

    if (erroPerfil) {
      setErro("Conta criada, mas não conseguimos salvar seus dados de saúde. Entre e complete seu perfil.");
      setCarregando(false);
      return;
    }

    router.replace("/home");
    router.refresh();
  }

  if (aguardandoConfirmacao) {
    return (
      <Card className="[--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <MailCheck className="mt-2 size-9 text-neutral-400" strokeWidth={1.6} aria-hidden />
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
              Confirme seu e-mail
            </h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-500">
              Enviamos um link de confirmação para{" "}
              <span className="font-medium text-neutral-700">{email.trim()}</span>.
              Depois de confirmar, é só entrar.
            </p>
          </div>
          <Button
            render={<Link href="/login" />}
            // O elemento é um <a> de verdade: sem isso a Base UI reclama
            // que perdeu a semântica nativa de <button>.
            nativeButton={false}
            className="h-12 w-full rounded-full text-base font-semibold"
          >
            Ir para o login
          </Button>
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
              Criar sua conta
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Leva um minuto. O centro usa esses dados para cuidar de você.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nome" className="text-neutral-700">
              Nome completo
            </Label>
            <Input
              id="nome"
              name="nome"
              type="text"
              autoComplete="name"
              placeholder="Maria da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              disabled={carregando}
              className="h-12 rounded-[14px] px-4 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-neutral-700">
              E-mail
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={carregando}
              className="h-12 rounded-[14px] px-4 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone" className="text-neutral-700">
              Telefone
            </Label>
            <Input
              id="telefone"
              name="telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 98888-7777"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              required
              disabled={carregando}
              className="h-12 rounded-[14px] px-4 text-base"
            />
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
                placeholder="Mínimo de 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={SENHA_MINIMA}
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

          <fieldset className="flex flex-col gap-2" disabled={carregando}>
            <legend className="mb-2.5 text-sm leading-none font-medium text-neutral-700">
              Condição clínica
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
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                      marcada
                        ? "bg-grafite text-white"
                        : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100",
                      carregando && "opacity-60"
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

            <p className="text-[13px] text-neutral-500">
              Pode marcar mais de uma. É por elas que o centro personaliza seu
              treino e seus indicadores.
            </p>
          </fieldset>

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
                Criando cadastro...
              </>
            ) : (
              "Criar cadastro"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
