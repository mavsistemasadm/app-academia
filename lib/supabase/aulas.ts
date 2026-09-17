import type { SupabaseClient } from '@supabase/supabase-js'

import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import { createClient } from './server'

export interface AulaNoDia {
  horarioId: string
  data: string
  titulo: string
  descricao: string | null
  local: string | null
  hora: string
  duracaoMin: number
  vagas: number
  ocupadas: number
  cancelada: boolean
  motivoCancelamento: string | null
  estouInscrito: boolean
}

export interface HorarioDaGrade {
  id: string
  professorId: string | null
  titulo: string
  descricao: string | null
  local: string | null
  diaSemana: number
  hora: string
  duracaoMin: number
  vagas: number
  paraTodos: boolean
  condicoes: string[]
  ativo: boolean
}

/** Quantos dias para a frente o aluno consegue marcar. */
export const DIAS_DE_AGENDA = 14

function montarAula(linha: Record<string, unknown>): AulaNoDia {
  return {
    horarioId: linha.horario_id as string,
    data: linha.data as string,
    titulo: linha.titulo as string,
    descricao: (linha.descricao as string | null) ?? null,
    local: (linha.local as string | null) ?? null,
    hora: linha.hora as string,
    duracaoMin: Number(linha.duracao_min ?? 60),
    vagas: Number(linha.vagas ?? 0),
    ocupadas: Number(linha.ocupadas ?? 0),
    cancelada: Boolean(linha.cancelada),
    motivoCancelamento: (linha.motivo_cancelamento as string | null) ?? null,
    estouInscrito: Boolean(linha.estou_inscrito),
  }
}

export interface AgendaDeAulas {
  aulas: AulaNoDia[]
  /** A tabela não respondeu — em geral, a migração 016 ainda não foi aplicada. */
  indisponivel: boolean
}

export async function getAulasDoPeriodo(
  supabase: SupabaseClient,
  inicio: string,
  fim: string
): Promise<AgendaDeAulas> {
  const { data, error } = await supabase.rpc('aulas_do_periodo', {
    p_inicio: inicio,
    p_fim: fim,
  })

  if (error) return { aulas: [], indisponivel: true }

  return {
    aulas: ((data ?? []) as Record<string, unknown>[]).map(montarAula),
    indisponivel: false,
  }
}

/** A agenda que o aluno vê: de hoje até `DIAS_DE_AGENDA` dias à frente. */
export async function getAgendaDoAluno(): Promise<AgendaDeAulas & { hoje: string }> {
  const supabase = await createClient()
  const hoje = hojeISO()
  const resultado = await getAulasDoPeriodo(
    supabase,
    hoje,
    somarDiasISO(hoje, DIAS_DE_AGENDA)
  )

  return { ...resultado, hoje }
}

export interface MinhaAula {
  id: string
  horarioId: string
  data: string
  titulo: string
  local: string | null
  hora: string
  duracaoMin: number
  cancelada: boolean
}

/**
 * As aulas que o aluno marcou, incluindo as que já aconteceram — é o
 * histórico dele. Passa pela RLS: só as próprias linhas.
 */
export async function getMinhasAulas(
  supabase: SupabaseClient,
  alunoId: string
): Promise<MinhaAula[]> {
  const { data } = await supabase
    .from('aula_inscricoes')
    .select('id, data, horario_id, aulas_horarios(titulo, hora, duracao_min, local)')
    .eq('aluno_id', alunoId)
    .order('data', { ascending: false })
    .limit(120)

  type Row = {
    id: string
    data: string
    horario_id: string
    aulas_horarios:
      | { titulo: string; hora: string; duracao_min: number; local: string | null }
      | { titulo: string; hora: string; duracao_min: number; local: string | null }[]
      | null
  }

  const linhas = (data ?? []) as Row[]
  if (linhas.length === 0) return []

  // Cancelamento é por data: a aula marcada pode ter caído depois.
  const { data: cancelados } = await supabase
    .from('aula_cancelamentos')
    .select('horario_id, data')
    .in('horario_id', [...new Set(linhas.map((l) => l.horario_id))])

  const caiu = new Set(
    ((cancelados ?? []) as { horario_id: string; data: string }[]).map(
      (c) => `${c.horario_id}:${c.data}`
    )
  )

  return linhas.map((linha) => {
    const h = Array.isArray(linha.aulas_horarios)
      ? linha.aulas_horarios[0]
      : linha.aulas_horarios

    return {
      id: linha.id,
      horarioId: linha.horario_id,
      data: linha.data,
      titulo: h?.titulo ?? 'Aula',
      local: h?.local ?? null,
      hora: h?.hora ?? '00:00:00',
      duracaoMin: h?.duracao_min ?? 60,
      cancelada: caiu.has(`${linha.horario_id}:${linha.data}`),
    }
  })
}

/** A grade inteira, para o professor montar a semana. */
export async function getGrade(): Promise<{ grade: HorarioDaGrade[]; indisponivel: boolean }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aulas_horarios')
    .select('*')
    .order('dia_semana', { ascending: true })
    .order('hora', { ascending: true })

  if (error) return { grade: [], indisponivel: true }

  return {
    indisponivel: false,
    grade: (data ?? []).map((h) => ({
      id: h.id as string,
      professorId: (h.professor_id as string | null) ?? null,
      titulo: h.titulo as string,
      descricao: (h.descricao as string | null) ?? null,
      local: (h.local as string | null) ?? null,
      diaSemana: Number(h.dia_semana),
      hora: h.hora as string,
      duracaoMin: Number(h.duracao_min ?? 60),
      vagas: Number(h.vagas ?? 0),
      paraTodos: Boolean(h.para_todos),
      condicoes: (h.avatar_condicao as string[] | null) ?? [],
      ativo: Boolean(h.ativo),
    })),
  }
}

export interface InscritoNaAula {
  inscricaoId: string
  alunoId: string
  nome: string
  fotoUrl: string | null
  telefone: string | null
}

/** Quem está marcado em cada aula do período (só o professor enxerga). */
export async function getInscritos(
  supabase: SupabaseClient,
  inicio: string,
  fim: string
): Promise<Record<string, InscritoNaAula[]>> {
  const { data } = await supabase
    .from('aula_inscricoes')
    .select('id, horario_id, data, aluno_id, profiles(nome, foto_url, telefone)')
    .gte('data', inicio)
    .lte('data', fim)

  type Row = {
    id: string
    horario_id: string
    data: string
    aluno_id: string
    profiles:
      | { nome: string; foto_url: string | null; telefone: string | null }
      | { nome: string; foto_url: string | null; telefone: string | null }[]
      | null
  }

  const porAula: Record<string, InscritoNaAula[]> = {}

  for (const linha of (data ?? []) as Row[]) {
    const p = Array.isArray(linha.profiles) ? linha.profiles[0] : linha.profiles
    const chave = `${linha.horario_id}:${linha.data}`
    ;(porAula[chave] ??= []).push({
      inscricaoId: linha.id,
      alunoId: linha.aluno_id,
      nome: p?.nome ?? 'Aluno',
      fotoUrl: p?.foto_url ?? null,
      telefone: p?.telefone ?? null,
    })
  }

  for (const lista of Object.values(porAula)) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome))
  }

  return porAula
}
