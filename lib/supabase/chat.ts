import type { Mensagem, PerfilResumo, Profile } from '@/lib/types'
import { createClient } from './server'

export interface Conversa {
  contato: PerfilResumo
  ultimaMensagem: Mensagem | null
  naoLidas: number
}

/**
 * Com quem o usuário conversa. Para o aluno é o professor responsável; para
 * o professor, todos os alunos — inclusive os que nunca escreveram, senão
 * não haveria como puxar assunto primeiro.
 */
export async function getConversas(perfil: Profile): Promise<Conversa[]> {
  const supabase = await createClient()

  const [{ data: mensagens }, { data: contatos }] = await Promise.all([
    supabase
      .from('mensagens')
      .select('*')
      .or(`de.eq.${perfil.id},para.eq.${perfil.id}`)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('profiles')
      .select('id, nome, foto_url, avatar_condicao')
      .eq('role', perfil.role === 'professor' ? 'aluno' : 'professor')
      .order('nome', { ascending: true }),
  ])

  const lista = (mensagens ?? []) as Mensagem[]

  const ultimaPorContato = new Map<string, Mensagem>()
  const naoLidasPorContato = new Map<string, number>()

  for (const mensagem of lista) {
    const outro = mensagem.de === perfil.id ? mensagem.para : mensagem.de

    if (!ultimaPorContato.has(outro)) ultimaPorContato.set(outro, mensagem)

    if (mensagem.para === perfil.id && !mensagem.lida) {
      naoLidasPorContato.set(outro, (naoLidasPorContato.get(outro) ?? 0) + 1)
    }
  }

  const conversas: Conversa[] = ((contatos ?? []) as PerfilResumo[]).map(
    (contato) => ({
      contato,
      ultimaMensagem: ultimaPorContato.get(contato.id) ?? null,
      naoLidas: naoLidasPorContato.get(contato.id) ?? 0,
    })
  )

  // Conversa viva primeiro; depois quem nunca trocou mensagem, por nome.
  return conversas.sort((a, b) => {
    if (a.naoLidas !== b.naoLidas) return b.naoLidas - a.naoLidas

    const dataA = a.ultimaMensagem?.created_at
    const dataB = b.ultimaMensagem?.created_at

    if (dataA && dataB) return dataB.localeCompare(dataA)
    if (dataA) return -1
    if (dataB) return 1

    return a.contato.nome.localeCompare(b.contato.nome)
  })
}

export interface ConversaAberta {
  contato: PerfilResumo
  mensagens: Mensagem[]
}

export async function getConversa(
  perfil: Profile,
  contatoId: string
): Promise<ConversaAberta | null> {
  const supabase = await createClient()

  const [{ data: contato }, { data: mensagens }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nome, foto_url, avatar_condicao')
      .eq('id', contatoId)
      .maybeSingle(),
    supabase
      .from('mensagens')
      .select('*')
      .or(
        `and(de.eq.${perfil.id},para.eq.${contatoId}),and(de.eq.${contatoId},para.eq.${perfil.id})`
      )
      .order('created_at', { ascending: true })
      .limit(200),
  ])

  if (!contato) return null

  // Marca como lidas as que chegaram — a tela está aberta agora.
  await supabase
    .from('mensagens')
    .update({ lida: true })
    .eq('de', contatoId)
    .eq('para', perfil.id)
    .eq('lida', false)

  return {
    contato: contato as PerfilResumo,
    mensagens: (mensagens ?? []) as Mensagem[],
  }
}
