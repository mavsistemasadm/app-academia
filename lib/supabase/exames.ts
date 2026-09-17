import type {
  Anamnese,
  AvatarCondicao,
  Exame,
  ExameCompartilhamento,
  Indicador,
  Medicamento,
} from '@/lib/types'
import {
  PERGUNTAS_PADRAO,
  respostasParaLeitura,
  type PerguntaAnamnese,
} from '@/lib/utils/anamnese'
import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import { FORMATO_TOKEN } from '@/lib/utils/exames'
import { resumirIndicador, type RegistroIndicador } from '@/lib/utils/indicadores'
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
  /** Medições dos últimos DIAS_DE_MEDICOES dias, da mais recente para a mais antiga. */
  medicoes: RegistroIndicador[]
  medicamentos: Pick<Medicamento, 'id' | 'nome' | 'dose' | 'horarios' | 'dias_semana'>[]
  /** Só as perguntas que o professor marcou como "vai ao médico". */
  anamnese: { pergunta: string; resposta: string }[]
  anamneseAtualizadaEm: string | null
}

/** Janela de medições que o médico enxerga pelo link. */
export const DIAS_DE_MEDICOES = 90

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

  const inicioMedicoes = somarDiasISO(hojeISO(), -DIAS_DE_MEDICOES)

  const [perfil, exames, indicadores, medicamentos, avaliacao, anamnese, perguntas] =
    await Promise.all([
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
      servico
        .from('indicadores')
        .select('*')
        .eq('aluno_id', alunoId)
        .gte('created_at', `${inicioMedicoes}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(300),
      servico
        .from('medicamentos')
        .select('id, nome, dose, horarios, dias_semana')
        .eq('aluno_id', alunoId)
        .eq('ativo', true)
        .order('nome', { ascending: true }),
      servico
        .from('avaliacoes_fisicas')
        .select('altura')
        .eq('aluno_id', alunoId)
        .not('altura', 'is', null)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle(),
      servico.from('anamneses').select('*').eq('aluno_id', alunoId).maybeSingle(),
      servico.from('anamnese_perguntas').select('*').eq('ativa', true).order('ordem'),
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
    medicoes: ((indicadores.data as Indicador[] | null) ?? []).map((i) =>
      resumirIndicador(i, (avaliacao.data?.altura as number | null) ?? null)
    ),
    medicamentos: (medicamentos.data as ExamesCompartilhadosData['medicamentos'] | null) ?? [],
    anamnese: respostasParaLeitura(
      // Antes da migração 011 a tabela não existe: vale a lista do código.
      ((perguntas.error ? PERGUNTAS_PADRAO : perguntas.data) as PerguntaAnamnese[]).filter(
        (p) => p.no_relatorio
      ),
      (anamnese.data as Anamnese | null) ?? null
    ).map(({ pergunta, texto }) => ({ pergunta: pergunta.enunciado, resposta: texto })),
    anamneseAtualizadaEm: (anamnese.data?.atualizado_em as string | undefined) ?? null,
    exames: lista.map((exame) => ({
      ...exame,
      url: urls.get(exame.arquivo_path) ?? null,
    })),
  }
}
