import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("profiles")
    .update({ push_subscription: corpo.assinatura ?? null })
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
