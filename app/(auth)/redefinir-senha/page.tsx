"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { traduzirErroAuth } from "@/lib/utils/erros-auth";

/**
 * Chega-se aqui pelo link do e-mail, já com sessão: `/auth/confirmar` trocou o
 * código do link por cookies. Sem sessão, o middleware manda para /login.
 */
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (senha.length < 6) {
      setErro("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }

    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setCarregando(true);

    const { data, error } = await supabase.auth.updateUser({ password: senha });

    if (error || !data.user) {
      setErro(traduzirErroAuth(error?.message));
      setCarregando(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.replace(profile?.role === "professor" ? "/dashboard" : "/home");
    router.refresh();
  }

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div>
            <p className="text-xl font-semibold tracking-tight text-neutral-900">Crie uma senha nova</p>
            <p className="mt-1 text-sm text-neutral-500">
              Depois de salvar, você já entra no app.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="senha" className="text-neutral-700">
              Nova senha
            </Label>
            <div className="relative">
              <Input
                id="senha"
                name="senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
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
              Repita a nova senha
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
              "Salvar senha e entrar"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
