import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/*
  O servidor faz POST no `endpoint` guardado aqui. Sem conferir, qualquer
  aluno faria a Vercel chamar o endereço que quisesse. Só aceita o formato
  que o navegador gera e os serviços de push conhecidos.
*/
const SERVICOS_DE_PUSH = [
  /(^|\.)googleapis\.com$/,
  /(^|\.)mozilla\.com$/,
  /(^|\.)mozaws\.net$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

function assinaturaValida(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false;
  const { endpoint, keys } = valor as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && SERVICOS_DE_PUSH.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

/**
 * Guarda (ou apaga) a assinatura de push do usuário logado. Roda com a
 * sessão dele, não com a service role: a policy `usuario_proprio_perfil`
 * garante que ninguém escreva no perfil de outro.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  let corpo: { assinatura?: unknown };

  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const assinatura = corpo.assinatura ?? null;
  if (assinatura !== null && !assinaturaValida(assinatura)) {
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ push_subscription: assinatura })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ erro: "Não foi possível salvar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  await supabase
    .from("profiles")
    .update({ push_subscription: null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
