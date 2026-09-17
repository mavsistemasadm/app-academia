import type { SupabaseClient } from '@supabase/supabase-js'

import { hojeISO } from '@/lib/utils/datas'
import {
  lerRegras,
  situacaoDoDesafio,
  type Habito,
  type Regras,
  type Situacao,
} from '@/lib/utils/desafios'
import { createClient } from './server'

export interface Desafio {
  id: string
  criado_por: string | null
  nome: string
  descricao: string | null
  inicio: string
  fim: string
  aberto: boolean
  regras: Regras
  cancelado: boolean
}

export interface DesafioNaLista {
  desafio: Desafio
  situacao: Situacao
  /** 'participando' | 'convidado' | 'fora' (aberto, dá para entrar) | 'saiu' */
  minhaSituacao: 'participando' | 'convidado' | 'fora' | 'saiu'
  participantes: number
  meusPontos: number | null
  minhaPosicao: number | null
}

export interface LinhaRanking {
  alunoId: string
  nome: string
  fotoUrl: string | null
  pontos: number
  diasAtivos: number
  souEu: boolean
}

export interface DetalhePontos {
  habito: Habito
  dias: number
  pontosPorDia: number
  pontos: number
}

function montar(linha: Record<string, unknown>): Desafio {
  return {
    id: linha.id as string,
    criado_por: (linha.criado_por as string | null) ?? null,
    nome: linha.nome as string,
    descricao: (linha.descricao as string | null) ?? null,
    inicio: linha.inicio as string,
    fim: linha.fim as string,
    aberto: Boolean(linha.aberto),
    regras: lerRegras(linha.regras),
    cancelado: Boolean(linha.cancelado),
  }
}

/** A tabela não respondeu — em geral, a migração 013 ainda não foi aplicada. */
export interface ListaDesafios {
  desafios: DesafioNaLista[]
  indisponivel: boolean
}

export async function getDesafiosDoAluno(alunoId: string): Promise<ListaDesafios> {
  const supabase = await createClient()

  const [{ data: linhas, error }, { data: minhas }, { data: resumo }] = await Promise.all([
    supabase
      .from('desafios')
      .select('*')
      .eq('cancelado', false)
      .order('fim', { ascending: false }),
    supabase.from('desafio_participantes').select('desafio_id, status').eq('aluno_id', alunoId),
    supabase.rpc('resumo_desafios'),
  ])

  if (error) return { desafios: [], indisponivel: true }

  const porDesafio = new Map(
    ((minhas ?? []) as { desafio_id: string; status: string }[]).map((m) => [m.desafio_id, m.status])
  )
  const resumos = new Map(
    ((resumo ?? []) as {
      desafio_id: string
      participantes: number
      meus_pontos: number | null
      minha_posicao: number | null
    }[]).map((r) => [r.desafio_id, r])
  )

  const hoje = hojeISO()

  return {
    indisponivel: false,
    desafios: (linhas ?? []).map((linha) => {
      const desafio = montar(linha)
      const status = porDesafio.get(desafio.id)
      const r = resumos.get(desafio.id)

      return {
        desafio,
        situacao: situacaoDoDesafio(desafio.inicio, desafio.fim, hoje),
        minhaSituacao:
          status === 'ativo'
            ? 'participando'
            : status === 'convidado'
              ? 'convidado'
              : status === 'saiu'
                ? 'saiu'
                : 'fora',
        participantes: r?.participantes ?? 0,
        meusPontos: r?.meus_pontos ?? null,
        minhaPosicao: r?.minha_posicao ?? null,
      }
    }),
  }
}

export async function getDesafio(id: string): Promise<Desafio | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('desafios').select('*').eq('id', id).maybeSingle()
  return data ? montar(data) : null
}

export async function getRanking(
  supabase: SupabaseClient,
  desafioId: string
): Promise<LinhaRanking[]> {
  const { data } = await supabase.rpc('ranking_desafio', { p_desafio: desafioId })

  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    alunoId: l.aluno_id as string,
    nome: l.nome as string,
    fotoUrl: (l.foto_url as string | null) ?? null,
    pontos: Number(l.pontos ?? 0),
    diasAtivos: Number(l.dias_ativos ?? 0),
    souEu: Boolean(l.sou_eu),
  }))
}

export async function getDetalhePontos(
  supabase: SupabaseClient,
  desafioId: string
): Promise<DetalhePontos[]> {
  const { data } = await supabase.rpc('detalhe_pontos_desafio', { p_desafio: desafioId })

  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    habito: l.habito as Habito,
    dias: Number(l.dias ?? 0),
    pontosPorDia: Number(l.pontos_por_dia ?? 0),
    pontos: Number(l.pontos ?? 0),
  }))
}

export interface DesafioDoProfessor extends DesafioNaLista {
  /** Convidados que ainda não aceitaram. */
  convidados: number
}

export async function getDesafiosDoProfessor(): Promise<{
  desafios: DesafioDoProfessor[]
  indisponivel: boolean
}> {
  const supabase = await createClient()

  const [{ data: linhas, error }, { data: participantes }, { data: resumo }] = await Promise.all([
    supabase.from('desafios').select('*').order('fim', { ascending: false }),
    supabase.from('desafio_participantes').select('desafio_id, status'),
    supabase.rpc('resumo_desafios'),
  ])

  if (error) return { desafios: [], indisponivel: true }

  const lista = (participantes ?? []) as { desafio_id: string; status: string }[]
  const resumos = new Map(
    ((resumo ?? []) as { desafio_id: string; participantes: number }[]).map((r) => [r.desafio_id, r])
  )
  const hoje = hojeISO()

  return {
    indisponivel: false,
    desafios: (linhas ?? []).map((linha) => {
      const desafio = montar(linha)
      const doDesafio = lista.filter((p) => p.desafio_id === desafio.id)

      return {
        desafio,
        situacao: situacaoDoDesafio(desafio.inicio, desafio.fim, hoje),
        minhaSituacao: 'fora' as const,
        participantes:
          resumos.get(desafio.id)?.participantes ??
          doDesafio.filter((p) => p.status === 'ativo').length,
        convidados: doDesafio.filter((p) => p.status === 'convidado').length,
        meusPontos: null,
        minhaPosicao: null,
      }
    }),
  }
}

/** Quem está em cada desafio, para o professor montar a lista de convidados. */
export async function getParticipantes(
  desafioId: string
): Promise<{ alunoId: string; status: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('desafio_participantes')
    .select('aluno_id, status')
    .eq('desafio_id', desafioId)

  return ((data ?? []) as { aluno_id: string; status: string }[]).map((p) => ({
    alunoId: p.aluno_id,
    status: p.status,
  }))
}
