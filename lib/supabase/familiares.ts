import type { FamiliarAcesso, Indicador, Profile } from '@/lib/types'
import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import { resumirIndicador, type RegistroIndicador } from '@/lib/utils/indicadores'
import { createClient } from './server'

/** Código curto e sem ambiguidade — some 0/O e 1/I, que confundem no telefone. */
export function gerarCodigoConvite(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(
    { length: 6 },
    () => alfabeto[Math.floor(Math.random() * alfabeto.length)]
  ).join('')
}

export async function getFamiliaresDoAluno(
  alunoId: string
): Promise<FamiliarAcesso[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('familiares_acesso')
    .select('*')
    .eq('aluno_id', alunoId)
    .order('created_at', { ascending: false })

  return (data ?? []) as FamiliarAcesso[]
}

export interface VisaoFamiliar {
  aluno: Pick<Profile, 'id' | 'nome' | 'foto_url'>
  parentesco: string | null
  /** O último registro de cada tipo. */
  indicadores: RegistroIndicador[]
  /** Datas com presença nos últimos 30 dias. */
  diasPresentes: string[]
  frequenciaNoMes: number
  ultimaPresenca: string | null
}

/**
 * O que o familiar autorizado enxerga: **só** indicadores e frequência.
 * Nada de treino, chat, humor ou anamnese — a RLS da migração 004 já
 * recusaria, e esta função nem chega a pedir.
 */
export async function getVisaoFamiliar(
  familiarId: string
): Promise<VisaoFamiliar[]> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const inicio = somarDiasISO(hoje, -29)

  const { data: vinculos } = await supabase
    .from('familiares_acesso')
    .select('aluno_id, parentesco, aluno:profiles!familiares_acesso_aluno_id_fkey(id, nome, foto_url)')
    .eq('familiar_id', familiarId)
    .eq('status', 'ativo')

  type Vinculo = {
    aluno_id: string
    parentesco: string | null
    aluno:
      | Pick<Profile, 'id' | 'nome' | 'foto_url'>
      | Pick<Profile, 'id' | 'nome' | 'foto_url'>[]
      | null
  }

  const lista = (vinculos ?? []) as Vinculo[]
  if (lista.length === 0) return []

  const ids = lista.map((v) => v.aluno_id)

  const [{ data: indicadores }, { data: checkins }, { data: execucoes }] =
    await Promise.all([
      supabase
        .from('indicadores')
        .select('*')
        .in('aluno_id', ids)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('checkins')
        .select('aluno_id, data')
        .in('aluno_id', ids)
        .gte('data', inicio),
      supabase
        .from('treino_execucoes')
        .select('aluno_id, data')
        .in('aluno_id', ids)
        .eq('concluido', true)
        .gte('data', inicio),
    ])

  const presencaPorAluno = new Map<string, Set<string>>()
  for (const registro of [...(checkins ?? []), ...(execucoes ?? [])]) {
    const set = presencaPorAluno.get(registro.aluno_id) ?? new Set<string>()
    set.add(registro.data as string)
    presencaPorAluno.set(registro.aluno_id, set)
  }

  return lista
    .map((vinculo): VisaoFamiliar | null => {
      const aluno = Array.isArray(vinculo.aluno)
        ? vinculo.aluno[0]
        : vinculo.aluno
      if (!aluno) return null

      const ultimos = new Map<string, RegistroIndicador>()
      for (const bruto of (indicadores ?? []) as Indicador[]) {
        if (bruto.aluno_id !== vinculo.aluno_id) continue
        if (ultimos.has(bruto.tipo)) continue
        // O familiar não vê avaliação física, então o peso fica sem IMC.
        ultimos.set(bruto.tipo, resumirIndicador(bruto, null))
      }

      const dias = Array.from(
        presencaPorAluno.get(vinculo.aluno_id) ?? new Set<string>()
      ).sort()

      return {
        aluno,
        parentesco: vinculo.parentesco,
        indicadores: Array.from(ultimos.values()),
        diasPresentes: dias,
        frequenciaNoMes: dias.filter((d) => d >= `${hoje.slice(0, 7)}-01`)
          .length,
        ultimaPresenca: dias[dias.length - 1] ?? null,
      }
    })
    .filter((v): v is VisaoFamiliar => v !== null)
}
