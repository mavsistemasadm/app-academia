"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { traduzirErroAuth } from "@/lib/utils/erros-auth";

export default function EsqueciSenhaPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Lido no efeito, e não com useSearchParams, para a página continuar
  // estática sem precisar de Suspense.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("link") === "invalido") {
      setErro("Esse link expirou ou já foi usado. Peça um novo abaixo.");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (!email.trim()) {
      setErro("Digite o e-mail do seu cadastro.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirmar?proximo=/redefinir-senha`,
    });

    setCarregando(false);

    // E-mail inexistente não volta erro no Supabase — e é bom que seja
    // assim: a tela não pode servir para descobrir quem é aluno da academia.
    if (error) {
      setErro(traduzirErroAuth(error.message));
      return;
    }

    setEnviado(true);
  }

  if (enviado) {
    return (
      <Card className="[--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-saude-verde-light text-saude-verde">
            <MailCheck className="size-7" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-semibold text-neutral-900">Confira seu e-mail</p>
            <p className="mt-1.5 text-base text-neutral-500">
              Se <strong className="text-neutral-700">{email.trim()}</strong> tiver
              cadastro, chega em instantes um link para criar uma senha nova.
              Olhe também a caixa de spam.
            </p>
          </div>
          <Link
            href="/login"
            className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div>
            <p className="text-lg font-semibold text-neutral-900">Esqueceu a senha?</p>
            <p className="mt-1 text-sm text-neutral-500">
              Digite seu e-mail e mandamos um link para você criar outra.
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
            disabled={carregando}
            className="h-12 w-full rounded-xl text-base font-semibold"
          >
            {carregando ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Enviando...
              </>
            ) : (
              "Enviar link"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Lembrou?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
