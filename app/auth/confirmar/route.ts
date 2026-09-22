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

  // Convite com `{{ .ConfirmationURL }}`: inviteUserByEmail não usa PKCE, a
  // sessão vem no `#access_token`, que não chega ao servidor. O redirect
  // preserva o fragmento e /definir-senha o lê no cliente (ou mostra "link
  // expirado" se não houver sessão).
  if (
    destino === "/definir-senha" &&
    !code &&
    !tokenHash &&
    !searchParams.get("error")
  ) {
    return NextResponse.redirect(new URL(destino, origin));
  }

  // Senha esquecida: o token segue intacto para /redefinir-senha, que só o
  // gasta quando a pessoa salva a senha nova. Gastar aqui no GET deixava o
  // link morto na mão de quem abre o e-mail: leitor de link do webmail ou
  // prévia do WhatsApp abre antes, e o clique de verdade dava "link expirou".
  if (destino === "/redefinir-senha" && tokenHash && tipo === "recovery") {
    const url = new URL(destino, origin);
    url.searchParams.set("token_hash", tokenHash);
    return NextResponse.redirect(url);
  }

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
    // Convite (/definir-senha) e confirmação de cadastro voltam para o login,
    // que avisa do link vencido; senha esquecida volta para pedir outro link.
    const volta = destino === "/redefinir-senha" ? "/esqueci-senha" : "/login";
    return NextResponse.redirect(new URL(`${volta}?link=invalido`, origin));
  }

  return NextResponse.redirect(new URL(destino, origin));
}
