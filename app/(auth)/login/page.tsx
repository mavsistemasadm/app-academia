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

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error || !data.user) {
      setErro(traduzirErroAuth(error?.message));
      setCarregando(false);
      return;
    }

    // O destino depende do papel: professor vai para o painel, aluno para a home.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const destino = profile?.role === "professor" ? "/dashboard" : "/home";

    // `refresh` faz o middleware reler a sessão recém-criada nos cookies.
    router.replace(destino);
    router.refresh();
  }

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div>
            <p className="text-xl font-semibold tracking-tight text-neutral-900">
              Entrar na sua conta
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Informe seus dados de acesso.
            </p>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="senha" className="text-neutral-700">
                Senha
              </Label>
              <Link
                href="/esqueci-senha"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Esqueci a senha
              </Link>
            </div>
            <div className="relative">
              <Input
                id="senha"
                name="senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
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
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Criar cadastro
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
