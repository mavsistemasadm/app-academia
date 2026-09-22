import { NextResponse, type NextRequest } from "next/server";

import { buscarUsuarioPorEmail } from "@/lib/supabase/convites";
import { ehAdmin } from "@/lib/supabase/equipe";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createServiceClient } from "@/lib/supabase/servico";
import { emailJaCadastrado, traduzirErroConvite } from "@/lib/utils/erros-auth";

/**
 * Equipe do centro. Só admin chama (professor com eh_admin, migração 017).
 *
 * POST  { nome, email, admin }  convida para a equipe. Se o e-mail já tem
 *       conta de aluno, a conta vira de professor.
 *       Resposta: { ok: true, situacao: "convidado" | "reenviado" | "promovido" }
 * PATCH { id, admin }           torna admin ou tira o admin de quem já é da equipe.
 *
 * O papel é gravado pela service role, que chega sem auth.uid() e por isso
 * passa pela trava de papel. Pelo app ninguém consegue se promover.
 */

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Servico = ReturnType<typeof createServiceClient>;

async function barrarQuemNaoEhAdmin() {
  const perfil = await getPerfilAtual();
  if (!perfil) {
    return { perfil: null, resposta: NextResponse.json({ erro: "Não autenticado" }, { status: 401 }) };
  }
  if (!ehAdmin(perfil)) {
    return {
      perfil: null,
      resposta: NextResponse.json({ erro: "Só o admin pode mexer na equipe." }, { status: 403 }),
    };
  }
  return { perfil, resposta: null };
}

/** Põe a conta na equipe: papel no app_metadata (lido pelo gatilho) e no perfil. */
async function colocarNaEquipe(servico: Servico, id: string, admin: boolean) {
  const { error: erroAuth } = await servico.auth.admin.updateUserById(id, {
    app_metadata: { role: "professor" },
  });
  if (erroAuth) return false;

  const { data } = await servico
    .from("profiles")
    .update({ role: "professor", eh_admin: admin })
    .eq("id", id)
    .select("role")
    .maybeSingle();

  return data?.role === "professor";
}

export async function POST(request: NextRequest) {
  const { resposta } = await barrarQuemNaoEhAdmin();
  if (resposta) return resposta;

  let corpo: { nome?: unknown; email?: unknown; admin?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const admin = corpo.admin === true;

  if (nome.length < 2) {
    return NextResponse.json({ erro: "Informe o nome." }, { status: 400 });
  }
  if (!EMAIL_VALIDO.test(email)) {
    return NextResponse.json(
      { erro: "E-mail inválido. Confira o endereço digitado." },
      { status: 400 }
    );
  }

  const origem = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(
    /\/$/,
    ""
  );
  const redirectTo = `${origem}/auth/confirmar?proximo=/definir-senha`;

  const servico = createServiceClient();

  // Com `convite` preenchido o modelo de e-mail troca o texto de aluno pelo da
  // equipe (docs/emails/invite.html). O convite de aluno não manda o campo.
  const { data, error } = await servico.auth.admin.inviteUserByEmail(email, {
    data: { nome, convite: "equipe" },
    redirectTo,
  });

  if (!error && data.user) {
    if (!(await colocarNaEquipe(servico, data.user.id, admin))) {
      return NextResponse.json(
        { erro: "O convite saiu, mas não conseguimos dar o acesso de professor. Tente de novo." },
        { status: 500 }
      );
    }

    // Mesmo critério do convite de aluno: o Supabase reenvia para quem não clicou.
    const criado = Date.parse(data.user.created_at ?? "");
    const convidado = Date.parse(data.user.invited_at ?? "");
    const reenviado =
      Number.isFinite(criado) && Number.isFinite(convidado) && convidado - criado > 60_000;

    return NextResponse.json({ ok: true, situacao: reenviado ? "reenviado" : "convidado" });
  }

  if (error && !emailJaCadastrado(error)) {
    const { mensagem, status } = traduzirErroConvite(error);
    return NextResponse.json({ erro: mensagem }, { status });
  }

  // E-mail que já tem conta: se for de aluno, a conta passa para a equipe.
  let existente;
  try {
    existente = await buscarUsuarioPorEmail(email);
  } catch {
    existente = null;
  }
  if (!existente) {
    return NextResponse.json(
      { erro: "Não foi possível enviar o convite agora. Tente novamente em instantes." },
      { status: 500 }
    );
  }

  const { data: perfilExistente } = await servico
    .from("profiles")
    .select("role, eh_admin")
    .eq("id", existente.id)
    .maybeSingle();

  if (perfilExistente?.role === "familiar") {
    return NextResponse.json(
      { erro: "Esse e-mail é de uma conta de familiar. Use outro e-mail para a equipe." },
      { status: 409 }
    );
  }
  if (perfilExistente?.role === "professor") {
    return NextResponse.json(
      { erro: "Essa pessoa já está na equipe. Para mudar o admin, use a lista abaixo." },
      { status: 409 }
    );
  }

  if (!(await colocarNaEquipe(servico, existente.id, admin))) {
    return NextResponse.json(
      { erro: "Não conseguimos dar o acesso de professor. Tente de novo." },
      { status: 500 }
    );
  }

  // Nunca entrou: o convite não pode ser reenviado a e-mail já confirmado,
  // então o link para criar a senha sai pelo fluxo de recuperação.
  if (!existente.last_sign_in_at) {
    await servico.auth.resetPasswordForEmail(email, { redirectTo });
  }

  return NextResponse.json({ ok: true, situacao: "promovido" });
}

export async function PATCH(request: NextRequest) {
  const { perfil, resposta } = await barrarQuemNaoEhAdmin();
  if (resposta) return resposta;

  let corpo: { id?: unknown; admin?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const id = typeof corpo.id === "string" ? corpo.id : "";
  if (!id || typeof corpo.admin !== "boolean") {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }
  const admin = corpo.admin;

  const servico = createServiceClient();

  const { data: alvo } = await servico
    .from("profiles")
    .select("role, eh_admin")
    .eq("id", id)
    .maybeSingle();

  if (alvo?.role !== "professor") {
    return NextResponse.json({ erro: "Essa pessoa não está na equipe." }, { status: 404 });
  }

  // A equipe nunca fica sem admin: sem ninguém, só pelo SQL Editor.
  if (!admin && alvo.eh_admin) {
    const { count } = await servico
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "professor")
      .eq("eh_admin", true);

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        {
          erro:
            id === perfil!.id
              ? "Você é o único admin. Torne outra pessoa admin antes de sair."
              : "Essa pessoa é o único admin da equipe.",
        },
        { status: 409 }
      );
    }
  }

  const { error } = await servico.from("profiles").update({ eh_admin: admin }).eq("id", id);
  if (error) {
    return NextResponse.json(
      { erro: "Não foi possível salvar agora. Tente de novo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
