import type { Profile } from '@/lib/types'

import { listarTodosUsuarios } from './convites'
import { createServiceClient } from './servico'

/*
  Equipe do centro: professores e admins. Usa a service role (auth.admin),
  então só pode ser importado de rota de API ou server component.
*/

export interface MembroEquipe {
  id: string
  nome: string
  email: string
  fotoUrl: string | null
  ehAdmin: boolean
  /** Convidado que ainda não clicou no link do e-mail. */
  pendente: boolean
  convidadoEm: string | null
}

export type ResultadoEquipe =
  | { disponivel: true; membros: MembroEquipe[] }
  /** A migração 017 ainda não rodou: a coluna eh_admin não existe. */
  | { disponivel: false }

/** Só professor com eh_admin mexe na equipe. */
export function ehAdmin(perfil: Profile | null): boolean {
  return perfil?.role === 'professor' && perfil.eh_admin === true
}

export async function listarEquipe(): Promise<ResultadoEquipe> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, email, foto_url, eh_admin')
    .eq('role', 'professor')
    .order('nome')

  if (error) {
    // 42703: coluna inexistente, ou seja, sem a 017.
    if (error.code === '42703') return { disponivel: false }
    throw error
  }

  const usuarios = await listarTodosUsuarios()
  const porId = new Map(usuarios.map((u) => [u.id, u]))

  const membros = (data ?? []).map((p) => {
    const usuario = porId.get(p.id)
    const pendente = Boolean(usuario?.invited_at) && !usuario?.last_sign_in_at
    return {
      id: p.id,
      nome: p.nome,
      email: p.email,
      fotoUrl: p.foto_url ?? null,
      ehAdmin: Boolean(p.eh_admin),
      pendente,
      convidadoEm: pendente ? (usuario?.invited_at as string) : null,
    }
  })

  // Quem já entrou primeiro, admins no topo; convites pendentes no fim.
  membros.sort(
    (a, b) =>
      Number(a.pendente) - Number(b.pendente) ||
      Number(b.ehAdmin) - Number(a.ehAdmin) ||
      a.nome.localeCompare(b.nome, 'pt-BR')
  )

  return { disponivel: true, membros }
}
