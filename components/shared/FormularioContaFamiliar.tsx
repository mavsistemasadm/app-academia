"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { traduzirErroAuth } from "@/lib/utils/erros-auth";

const CAMPO = "h-12 rounded-[14px] px-4 text-base";

/**
 * Conta de quem vai acompanhar um aluno. O aluno gera o convite em "Dar
 * acesso à família" e manda o link `/familia?codigo=XXXXXX`; aqui a pessoa
 * cria a conta e cai direto em /acompanhar, já vinculada.
 */
export function FormularioContaFamiliar({ codigoInicial }: { codigoInicial: string }) {
  const router = useRouter();

  const [codigo, setCodigo] = useState(codigoInicial.toUpperCase().slice(0, 6));
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jaTemConta, setJaTemConta] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function criarConta(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setJaTemConta(false);
    setCarregando(true);

    let resposta: { ok?: boolean; erro?: string; jaTemConta?: boolean };
    try {
      const r = await fetch("/api/familia/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, nome, email, senha }),
      });
      resposta = await r.json();
    } catch {
      resposta = { erro: "Sem conexão com o servidor. Verifique sua internet." };
    }

    if (!resposta.ok) {
      setErro(resposta.erro ?? "Não conseguimos criar a conta. Tente de novo.");
      setJaTemConta(Boolean(resposta.jaTemConta));
      setCarregando(false);
      return;
    }

    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      setErro(`Conta criada, mas não deu para entrar: ${traduzirErroAuth(error.message)}`);
      setCarregando(false);
      return;
    }

    router.replace("/acompanhar");
    router.refresh();
  }

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent>
        <form onSubmit={criarConta} className="flex flex-col gap-5" noValidate>
          <div>
            <p className="text-xl font-semibold tracking-tight text-neutral-900">
              Acompanhar um familiar
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              Crie seu acesso com o código que ele gerou no app. Você vai ver os
              indicadores de saúde e a frequência na academia.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="codigo" className="text-neutral-700">
              Código do convite
            </Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              disabled={carregando}
              className="numero h-14 rounded-[14px] px-4 text-center text-[24px] font-semibold tracking-[0.3em] placeholder:text-neutral-300 md:text-[24px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nome" className="text-neutral-700">
              Seu nome
            </Label>
            <Input
              id="nome"
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={carregando}
              className={CAMPO}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-neutral-700">
              Seu e-mail
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={carregando}
              className={CAMPO}
            />
            <p className="text-[13px] text-neutral-500">
              O mesmo e-mail que seu familiar informou ao gerar o código.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="senha" className="text-neutral-700">
              Crie uma senha
            </Label>
            <div className="relative">
              <Input
                id="senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Pelo menos 8 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={carregando}
                className={`${CAMPO} pr-12`}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600"
              >
                {mostrarSenha ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            </div>
          </div>

          {erro && (
            <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {erro}
                {jaTemConta && (
                  <>
                    {" "}
                    <Link
                      href={`/login`}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Entrar →
                    </Link>
                  </>
                )}
              </span>
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
                Criando acesso...
              </>
            ) : (
              "Criar acesso e acompanhar"
            )}
          </Button>
        </form>

        <p className="mt-6 border-t border-neutral-200/80 pt-5 text-center text-sm text-neutral-500">
          Já tem conta no app?{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
