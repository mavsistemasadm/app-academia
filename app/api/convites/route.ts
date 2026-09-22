import { NextResponse, type NextRequest } from "next/server";

import type { AvatarCondicao } from "@/lib/types";
import { buscarUsuarioPorEmail } from "@/lib/supabase/convites";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createServiceClient } from "@/lib/supabase/servico";
import { AVATAR_CONFIG } from "@/lib/utils/avatares";
import { emailJaCadastrado, traduzirErroConvite } from "@/lib/utils/erros-auth";

/**
 * Convite de aluno. Só professor chama; o e-mail sai pelo próprio Supabase
 * (template "Invite user") e o link cai em /auth/confirmar → /definir-senha.
 *
 * Corpo: { nome, email, telefone?, avatar_condicao?: string[] }
 * Resposta: { ok: true, reenviado: boolean } ou { erro }.
 */

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  const perfil = await getPerfilAtual();

  if (!perfil) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  if (perfil.role !== "professor") {
    return NextResponse.json(
      { erro: "Só o professor pode convidar alunos." },
      { status: 403 }
    );
  }

  let corpo: {
    nome?: unknown;
    email?: unknown;
    telefone?: unknown;
    avatar_condicao?: unknown;
  };

  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const telefone =
    typeof corpo.telefone === "string" ? corpo.telefone.trim().slice(0, 30) : "";
  const condicoes = Array.isArray(corpo.avatar_condicao)
    ? (corpo.avatar_condicao.filter(
        (c): c is AvatarCondicao => typeof c === "string" && c in AVATAR_CONFIG
      ) as AvatarCondicao[])
    : [];

  if (nome.length < 2) {
    return NextResponse.json({ erro: "Informe o nome do aluno." }, { status: 400 });
  }
  if (!EMAIL_VALIDO.test(email)) {
    return NextResponse.json(
      { erro: "E-mail inválido. Confira o endereço digitado." },
      { status: 400 }
    );
  }

  // Sem variável de URL pública, a origem da própria requisição resolve —
  // localhost em dev, o domínio da Vercel em produção.
  const origem = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(
    /\/$/,
    ""
  );
  const redirectTo = `${origem}/auth/confirmar?proximo=/definir-senha`;

  const supabase = createServiceClient();

  // O gatilho handle_new_user lê nome/telefone/avatar_condicao daqui. O papel
  // vem de app_metadata, que ninguém preenche aqui — o convidado nasce aluno.
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      nome,
      ...(telefone ? { telefone } : {}),
      ...(condicoes.length ? { avatar_condicao: condicoes } : {}),
    },
    redirectTo,
  });

  if (!error) {
    // Para quem ainda não tinha clicado, o Supabase reenvia o convite para o
    // mesmo usuário: invited_at avança, created_at fica o antigo.
    const criado = data.user?.created_at ? Date.parse(data.user.created_at) : NaN;
    const convidado = data.user?.invited_at ? Date.parse(data.user.invited_at) : NaN;
    const reenviado =
      Number.isFinite(criado) && Number.isFinite(convidado) && convidado - criado > 60_000;

    return NextResponse.json({ ok: true, reenviado });
  }

  if (!emailJaCadastrado(error)) {
    const { mensagem, status } = traduzirErroConvite(error);
    return NextResponse.json({ erro: mensagem }, { status });
  }

  // E-mail já cadastrado. Se a pessoa nunca entrou, manda um link para criar
  // a senha pelo fluxo de recuperação (o convite não pode ser reenviado a um
  // e-mail já confirmado). Se já entrou, ela tem acesso.
  let existente;
  try {
    existente = await buscarUsuarioPorEmail(email);
  } catch {
    existente = null;
  }

  if (existente && !existente.last_sign_in_at) {
    const { error: erroReenvio } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (erroReenvio) {
      const { mensagem, status } = traduzirErroConvite(erroReenvio);
      return NextResponse.json({ erro: mensagem }, { status });
    }

    return NextResponse.json({ ok: true, reenviado: true });
  }

  return NextResponse.json(
    {
      erro:
        "Esse e-mail já tem acesso ao app. Se a pessoa esqueceu a senha, ela pode usar \"Esqueci a senha\" no login.",
    },
    { status: 409 }
  );
}
