import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/servico";
import { emailJaCadastrado } from "@/lib/utils/erros-auth";
import { FORMATO_CODIGO_FAMILIAR } from "@/lib/utils/papel";

/**
 * Conta de familiar, criada por quem recebeu um código de acompanhamento.
 * Sem sessão: é a porta de entrada de quem ainda não tem conta.
 *
 * Código sozinho não basta: o e-mail precisa ser o mesmo que o aluno
 * escreveu no convite. As duas coisas erradas dão a mesma resposta, para a
 * rota não servir de verificador de código.
 *
 * Corpo: { codigo, nome, email, senha }
 * Resposta: { ok: true } ou { erro, jaTemConta? }.
 */

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SENHA_MINIMA = 8;
const NAO_CONFERE =
  "Código e e-mail não conferem com nenhum convite pendente. Use o e-mail que seu familiar cadastrou no convite.";

export async function POST(request: NextRequest) {
  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const texto = (campo: string) => (typeof corpo[campo] === "string" ? (corpo[campo] as string) : "");
  const codigo = texto("codigo").trim().toUpperCase();
  const nome = texto("nome").trim().slice(0, 120);
  const email = texto("email").trim().toLowerCase();
  const senha = texto("senha");

  if (!FORMATO_CODIGO_FAMILIAR.test(codigo)) {
    return NextResponse.json({ erro: "O código tem 6 letras e números." }, { status: 400 });
  }
  if (nome.length < 2) {
    return NextResponse.json({ erro: "Diga seu nome." }, { status: 400 });
  }
  if (!EMAIL_VALIDO.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido. Confira o endereço digitado." }, { status: 400 });
  }
  if (senha.length < SENHA_MINIMA) {
    return NextResponse.json(
      { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` },
      { status: 400 }
    );
  }

  const servico = createServiceClient();

  const { data: convite } = await servico
    .from("familiares_acesso")
    .select("id, email, status, familiar_id")
    .eq("codigo", codigo)
    .maybeSingle();

  if (
    !convite ||
    convite.status !== "pendente" ||
    convite.familiar_id ||
    (convite.email as string).trim().toLowerCase() !== email
  ) {
    return NextResponse.json({ erro: NAO_CONFERE }, { status: 400 });
  }

  const { data: criado, error } = await servico.auth.admin.createUser({
    email,
    password: senha,
    // O e-mail já foi confirmado de outro jeito: é o que o aluno escreveu no convite.
    email_confirm: true,
    user_metadata: { nome },
    app_metadata: { role: "familiar" },
  });

  if (error || !criado.user) {
    if (error && emailJaCadastrado(error)) {
      return NextResponse.json(
        {
          erro: "Esse e-mail já tem conta no app. Entre com ela e digite o código em Acompanhar.",
          jaTemConta: true,
        },
        { status: 409 }
      );
    }
    if (error && /password/i.test(error.message)) {
      return NextResponse.json(
        { erro: "Essa senha é fraca demais. Tente uma mais longa, com letras e números." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { erro: "Não conseguimos criar a conta agora. Tente de novo em instantes." },
      { status: 500 }
    );
  }

  const usuarioId = criado.user.id;

  // O Auth grava o app_metadata depois do insert, então o gatilho
  // handle_new_user ainda vê a conta sem papel e cria o perfil como aluno
  // (é o mesmo motivo de criar_professor.sql acertar o perfil à parte). A
  // service role chega sem auth.uid(), que a trava de papel da 005 deixa
  // passar. Se não der (sem a migração 012, o check recusa 'familiar'),
  // desfaz: conta de familiar como aluno apareceria na lista do professor.
  const { data: perfil } = await servico
    .from("profiles")
    .update({ role: "familiar" })
    .eq("id", usuarioId)
    .select("role")
    .maybeSingle();

  if (perfil?.role !== "familiar") {
    await servico.auth.admin.deleteUser(usuarioId);
    return NextResponse.json(
      { erro: "O acesso de familiar ainda está sendo ativado. Tente de novo mais tarde." },
      { status: 503 }
    );
  }

  await servico
    .from("familiares_acesso")
    .update({ familiar_id: usuarioId, status: "ativo", aceito_em: new Date().toISOString() })
    .eq("id", convite.id)
    .eq("status", "pendente")
    .is("familiar_id", null);

  return NextResponse.json({ ok: true });
}
