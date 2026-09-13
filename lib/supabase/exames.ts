import type { AvatarCondicao, Exame, ExameCompartilhamento } from '@/lib/types'
import { FORMATO_TOKEN } from '@/lib/utils/exames'
import { createClient } from './server'
import { createServiceClient } from './servico'

/** Quanto vale a URL assinada de cada arquivo na página pública. */
const VALIDADE_URL_SEGUNDOS = 60 * 60

export interface ExamesAlunoData {
  exames: Exame[]
  /** Só os que ainda abrem: não revogados e dentro do prazo. */
  compartilhamentos: ExameCompartilhamento[]
  /** A tabela não respondeu — em geral, a migração 007 ainda não foi aplicada. */
  indisponivel: boolean
}

function linkAtivo(link: ExameCompartilhamento, agora: number) {
  if (link.revogado) return false
  return !link.expira_em || new Date(link.expira_em).getTime() > agora
}

/** Exames do aluno logado (via RLS), do mais recente para o mais antigo. */
export async function getExamesAluno(alunoId: string): Promise<ExamesAlunoData> {
  const supabase = await createClient()

  const [exames, links] = await Promise.all([
    supabase
      .from('exames')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('data_exame', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('exames_compartilhamentos')
      .select('*')
      .eq('aluno_id', alunoId)
      .eq('revogado', false)
      .order('criado_em', { ascending: false }),
  ])

  const agora = Date.now()

  return {
    exames: (exames.data as Exame[] | null) ?? [],
    compartilhamentos: ((links.data as ExameCompartilhamento[] | null) ?? []).filter(
      (link) => linkAtivo(link, agora)
    ),
    indisponivel: Boolean(exames.error || links.error),
  }
}

export interface ExameCompartilhado extends Exame {
  /** URL assinada de 1 hora; `null` se o arquivo sumiu do storage. */
  url: string | null
}

export interface ExamesCompartilhadosData {
  aluno: {
    nome: string
    data_nascimento: string | null
    avatar_condicao: AvatarCondicao[] | null
  }
  expiraEm: string | null
  exames: ExameCompartilhado[]
}

/**
 * O que a página pública do médico enxerga. Usa a service role — **só do
 * servidor** — e por isso valida tudo antes: formato do token, revogação e
 * prazo. Token inválido devolve `null`, sem dizer por quê.
 */
export async function getExamesCompartilhados(
  token: string
): Promise<ExamesCompartilhadosData | null> {
  if (!FORMATO_TOKEN.test(token)) return null

  let servico: ReturnType<typeof createServiceClient>
  try {
    servico = createServiceClient()
  } catch {
    return null
  }

  const { data: link } = await servico
    .from('exames_compartilhamentos')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (!link || !linkAtivo(link as ExameCompartilhamento, Date.now())) return null

  const alunoId = (link as ExameCompartilhamento).aluno_id

  const [perfil, exames] = await Promise.all([
    servico
      .from('profiles')
      .select('nome, data_nascimento, avatar_condicao')
      .eq('id', alunoId)
      .maybeSingle(),
    servico
      .from('exames')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('data_exame', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (!perfil.data) return null

  const lista = (exames.data as Exame[] | null) ?? []
  const urls = new Map<string, string>()

  if (lista.length > 0) {
    const { data: assinadas } = await servico.storage
      .from('exames')
      .createSignedUrls(
        lista.map((e) => e.arquivo_path),
        VALIDADE_URL_SEGUNDOS
      )

    for (const item of assinadas ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        urls.set(item.path, item.signedUrl)
      }
    }
  }

  return {
    aluno: {
      nome: perfil.data.nome as string,
      data_nascimento: (perfil.data.data_nascimento as string | null) ?? null,
      avatar_condicao: (perfil.data.avatar_condicao as AvatarCondicao[] | null) ?? null,
    },
    expiraEm: (link as ExameCompartilhamento).expira_em ?? null,
    exames: lista.map((exame) => ({
      ...exame,
      url: urls.get(exame.arquivo_path) ?? null,
    })),
  }
}
