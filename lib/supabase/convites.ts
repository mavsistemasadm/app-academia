import type { User } from '@supabase/supabase-js'

import { createServiceClient } from './servico'

/*
  Convites de aluno. Usa a service role (auth.admin), então só pode ser
  importado de rota de API ou server component — nunca de "use client".
*/

export interface ConvitePendente {
  id: string
  nome: string
  email: string
  convidadoEm: string
}

/** Todos os usuários do Auth. A academia é pequena; 1000 por página sobra. */
export async function listarTodosUsuarios(): Promise<User[]> {
  const supabase = createServiceClient()
  const todos: User[] = []

  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: 1000,
    })
    if (error) throw error

    todos.push(...data.users)
    if (data.users.length < 1000) break
  }

  return todos
}

export async function buscarUsuarioPorEmail(email: string): Promise<User | null> {
  const alvo = email.trim().toLowerCase()
  const usuarios = await listarTodosUsuarios()
  return usuarios.find((u) => u.email?.toLowerCase() === alvo) ?? null
}

/** Quem foi convidado e ainda não clicou no link (nunca entrou). */
export async function listarConvitesPendentes(): Promise<ConvitePendente[]> {
  const usuarios = await listarTodosUsuarios()

  return usuarios
    .filter(
      (u) =>
        Boolean(u.invited_at) &&
        !u.last_sign_in_at &&
        u.app_metadata?.role !== 'professor'
    )
    .map((u) => ({
      id: u.id,
      nome:
        (typeof u.user_metadata?.nome === 'string' && u.user_metadata.nome) ||
        (u.email ?? '').split('@')[0],
      email: u.email ?? '',
      convidadoEm: u.invited_at as string,
    }))
    .sort((a, b) => b.convidadoEm.localeCompare(a.convidadoEm))
}
