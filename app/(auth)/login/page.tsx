"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { traduzirErroAuth } from "@/lib/utils/erros-auth";

// WhatsApp da Atitude Vital, com a primeira mensagem já escrita.
const LINK_WHATSAPP = `https://wa.me/5548984591376?text=${encodeURIComponent(
  "Olá! Vim pelo app da Atitude Vital e quero ser aluno. Pode me passar mais informações?"
)}`;

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // `/auth/confirmar` devolve para cá com ?link=invalido quando o link do
  // e-mail (convite ou confirmação) venceu. Mesmo padrão de /esqueci-senha.
  const linkInvalido = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("link") === "invalido",
    () => false
  );
  const [linkDescartado, setLinkDescartado] = useState(false);

  const erroVisivel =
    erro ??
    (linkInvalido && !linkDescartado
      ? "Esse link expirou ou já foi usado. Se era um convite, peça ao seu professor para reenviar."
      : null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setLinkDescartado(true);
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

          {erroVisivel && (
            <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {erroVisivel}
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

        {/*
          Conta de aluno nasce sempre do convite da academia — não há cadastro
          aberto. Quem ainda não é aluno fala direto com o centro.
        */}
        <div className="mt-6 flex flex-col gap-3 border-t border-neutral-200/80 pt-5">
          <p className="text-center text-sm text-neutral-500">Ainda não é aluno?</p>
          <a
            href={LINK_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-12 items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold text-neutral-950 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-50 hover:ring-neutral-300 active:scale-[.98]"
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-[#25D366]" aria-hidden>
              <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.43-9.43 2.52 0 4.88.98 6.66 2.77a9.36 9.36 0 0 1 2.76 6.67c0 5.2-4.23 9.42-9.43 9.42m8.02-17.45A11.27 11.27 0 0 0 12.05.75C5.8.75.72 5.83.72 12.08c0 2 .52 3.95 1.52 5.66L.62 23.25l5.64-1.48a11.3 11.3 0 0 0 5.78 1.47h.01c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.88-3.31-8.02" />
            </svg>
            Quero ser aluno
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
