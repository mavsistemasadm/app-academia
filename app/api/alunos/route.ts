import { NextResponse, type NextRequest } from "next/server";

import { ehAdmin } from "@/lib/supabase/equipe";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { createServiceClient } from "@/lib/supabase/servico";

/**
 * Conta do aluno. Só admin chama (professor com eh_admin, migração 017).
 *
 * PATCH  { id, ativo }  inativa ou reativa. Inativo não entra no app (ban),
 *        some das listas, dos lembretes e dos alertas, e o histórico fica
 *        guardado para quando voltar.
 * DELETE { id, nome }   exclui de vez. `nome` é o nome completo digitado na
 *        tela, conferido aqui também. As chaves da 006 apagam em cascata o que
 *        é do aluno; os arquivos dele no storage saem logo antes.
 */

type Servico = ReturnType<typeof createServiceClient>;

/** Buckets em que o primeiro nível do caminho é o id do aluno. */
const BUCKETS_DO_ALUNO = ["avatares", "medicamentos", "exames"];

async function barrarQuemNaoEhAdmin() {
  const perfil = await getPerfilAtual();
  if (!perfil) {
    return { perfil: null, resposta: NextResponse.json({ erro: "Não autenticado" }, { status: 401 }) };
  }
  if (!ehAdmin(perfil)) {
    return {
      perfil: null,
      resposta: NextResponse.json(
        { erro: "Só o admin pode inativar ou excluir aluno." },
        { status: 403 }
      ),
    };
  }
  return { perfil, resposta: null };
}

async function lerCorpo(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const corpo = await request.json();
    return corpo && typeof corpo === "object" ? corpo : null;
  } catch {
    return null;
  }
}

/** Só conta de aluno passa: professor sai pela equipe, familiar pelo aluno. */
async function buscarAluno(servico: Servico, id: string) {
  const { data } = await servico
    .from("profiles")
    .select("id, nome, role")
    .eq("id", id)
    .maybeSingle();
  return data?.role === "aluno" ? (data as { id: string; nome: string }) : null;
}

/** Todos os caminhos de arquivo debaixo de uma pasta, descendo nas subpastas. */
async function listarArquivos(servico: Servico, bucket: string, pasta: string): Promise<string[]> {
  const { data } = await servico.storage.from(bucket).list(pasta, { limit: 1000 });
  const caminhos: string[] = [];
  for (const item of data ?? []) {
    const caminho = `${pasta}/${item.name}`;
    // Pasta vem sem id; arquivo vem com.
    if (item.id) caminhos.push(caminho);
    else caminhos.push(...(await listarArquivos(servico, bucket, caminho)));
  }
  return caminhos;
}

export async function PATCH(request: NextRequest) {
  const { resposta } = await barrarQuemNaoEhAdmin();
  if (resposta) return resposta;

  const corpo = await lerCorpo(request);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!id || typeof corpo?.ativo !== "boolean") {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }
  const ativo = corpo.ativo;

  const servico = createServiceClient();
  if (!(await buscarAluno(servico, id))) {
    return NextResponse.json({ erro: "Aluno não encontrado." }, { status: 404 });
  }

  // Login primeiro: se falhar, o aluno não fica escondido das listas e ainda
  // entrando no app.
  const { error: erroAuth } = await servico.auth.admin.updateUserById(id, {
    ban_duration: ativo ? "none" : "876000h",
  });
  if (erroAuth) {
    return NextResponse.json(
      { erro: "Não foi possível mudar o acesso agora. Tente de novo." },
      { status: 500 }
    );
  }

  const { error } = await servico.from("profiles").update({ ativo }).eq("id", id);
  if (error) {
    return NextResponse.json(
      { erro: "Não foi possível salvar agora. Tente de novo." },
      { status: 500 }
    );
  }

  if (!ativo) {
    // Alerta aberto de quem saiu só polui o painel.
    await servico
      .from("alertas_professor")
      .update({ resolvido: true })
      .eq("aluno_id", id)
      .eq("resolvido", false);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { resposta } = await barrarQuemNaoEhAdmin();
  if (resposta) return resposta;

  const corpo = await lerCorpo(request);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  const nome = typeof corpo?.nome === "string" ? corpo.nome : "";
  if (!id) return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });

  const servico = createServiceClient();
  const aluno = await buscarAluno(servico, id);
  if (!aluno) {
    return NextResponse.json({ erro: "Aluno não encontrado." }, { status: 404 });
  }

  const normalizar = (texto: string) => texto.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalizar(nome) !== normalizar(aluno.nome)) {
    return NextResponse.json(
      { erro: "O nome digitado não confere com o do aluno." },
      { status: 400 }
    );
  }

  // Arquivos antes da conta: depois dela não sobra quem aponte para eles.
  for (const bucket of BUCKETS_DO_ALUNO) {
    const caminhos = await listarArquivos(servico, bucket, id);
    if (caminhos.length) await servico.storage.from(bucket).remove(caminhos);
  }

  const { error } = await servico.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json(
      { erro: "Não foi possível excluir agora. Tente de novo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
