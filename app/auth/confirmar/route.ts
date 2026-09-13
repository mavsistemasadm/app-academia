import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Destino dos links que o Supabase manda por e-mail (confirmar cadastro,
 * redefinir senha). Troca o código do link por uma sessão nos cookies e
 * segue para `proximo`.
 *
 * Aceita os dois formatos: `code` (PKCE, o padrão do @supabase/ssr) e
 * `token_hash` + `type` (quando o template do e-mail é personalizado).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const proximo = searchParams.get("proximo");

  // Só caminho interno: `//site.com` ou URL absoluta viraria redirecionamento
  // aberto a partir de um link que parece ser da academia.
  const destino =
    proximo?.startsWith("/") && !proximo.startsWith("//") ? proximo : "/home";

  const supabase = await createClient();

  let falhou = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    falhou = Boolean(error);
  } else if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({
      type: tipo,
      token_hash: tokenHash,
    });
    falhou = Boolean(error);
  }

  if (falhou) {
    const volta = destino === "/redefinir-senha" ? "/esqueci-senha" : "/login";
    return NextResponse.redirect(new URL(`${volta}?link=invalido`, origin));
  }

  return NextResponse.redirect(new URL(destino, origin));
}
