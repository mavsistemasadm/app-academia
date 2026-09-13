import type { Checkin, Profile } from '@/lib/types'
import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import { createClient } from './server'

export interface PresencaAlunoData {
  hoje: string
  checkinDeHoje: Checkin | null
  /** Datas `YYYY-MM-DD` com presença nos últimos 90 dias. */
  diasPresentes: string[]
  noMes: number
  /** Dias seguidos indo à academia, contando de hoje para trás. */
  sequencia: number
  /** Quantos alunos estão na academia neste momento. */
  presentesAgora: number
}

/**
 * Presença conta check-in e treino registrado: quem esqueceu de bater o
 * check-in mas concluiu o treino esteve lá do mesmo jeito.
 */
async function diasComPresenca(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alunoId: string,
  desde: string
): Promise<Set<string>> {
  const [{ data: checkins }, { data: execucoes }] = await Promise.all([
    supabase
      .from('checkins')
      .select('data')
      .eq('aluno_id', alunoId)
      .gte('data', desde),
    supabase
      .from('treino_execucoes')
      .select('data')
      .eq('aluno_id', alunoId)
      .eq('concluido', true)
      .gte('data', desde),
  ])

  return new Set([
    ...(checkins ?? []).map((c) => c.data as string),
    ...(execucoes ?? []).map((e) => e.data as string),
  ])
}

export async function getPresencaAluno(
  alunoId: string
): Promise<PresencaAlunoData> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const inicioJanela = somarDiasISO(hoje, -89)
  const inicioMes = `${hoje.slice(0, 7)}-01`

  const [{ data: checkinHoje }, presentes, dias] = await Promise.all([
    supabase
      .from('checkins')
      .select('*')
      .eq('aluno_id', alunoId)
      .eq('data', hoje)
      .maybeSingle(),
    supabase
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('data', hoje)
      .is('saida', null),
    diasComPresenca(supabase, alunoId, inicioJanela),
  ])

  // Sequência: hoje sem treino ainda não quebra nada — começa em ontem.
  let sequencia = 0
  let cursor = dias.has(hoje) ? hoje : somarDiasISO(hoje, -1)
  while (dias.has(cursor)) {
    sequencia += 1
    cursor = somarDiasISO(cursor, -1)
  }

  return {
    hoje,
    checkinDeHoje: (checkinHoje as Checkin | null) ?? null,
    diasPresentes: Array.from(dias).sort(),
    noMes: Array.from(dias).filter((d) => d >= inicioMes).length,
    sequencia,
    presentesAgora: presentes.count ?? 0,
  }
}

export interface PresencaNoPainel {
  presentes: (Checkin & { aluno?: Profile })[]
  /** Alunos sem nenhuma presença há muitos dias. */
  sumidos: { perfil: Profile; diasSemAparecer: number | null }[]
  /** Presenças por dia nos últimos 30 dias, do mais antigo ao mais recente. */
  porDia: { data: string; total: number }[]
  totalNoMes: number
}

export async function getPresencaProfessor(
  diasParaSumico: number
): Promise<PresencaNoPainel> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const inicio = somarDiasISO(hoje, -29)
  const inicioMes = `${hoje.slice(0, 7)}-01`

  const [{ data: checkins }, { data: execucoes }, { data: perfis }] =
    await Promise.all([
      supabase
        .from('checkins')
        .select('*, aluno:profiles!checkins_aluno_id_fkey(id, nome, foto_url)')
        .gte('data', inicio)
        .order('entrada', { ascending: false }),
      supabase
        .from('treino_execucoes')
        .select('aluno_id, data')
        .eq('concluido', true)
        .gte('data', inicio),
      supabase.from('profiles').select('*').eq('role', 'aluno'),
    ])

  type Row = Omit<Checkin, 'aluno'> & { aluno: Profile | Profile[] | null }

  const lista = ((checkins ?? []) as Row[]).map((c) => ({
    ...c,
    aluno: (Array.isArray(c.aluno) ? c.aluno[0] : c.aluno) ?? undefined,
  }))

  const presentes = lista.filter((c) => c.data === hoje && !c.saida)

  // ── Última presença por aluno ───────────────────────────────────
  const ultima = new Map<string, string>()
  for (const c of lista) {
    const atual = ultima.get(c.aluno_id)
    if (!atual || c.data > atual) ultima.set(c.aluno_id, c.data)
  }
  for (const e of execucoes ?? []) {
    const atual = ultima.get(e.aluno_id)
    if (!atual || e.data > atual) ultima.set(e.aluno_id, e.data)
  }

  const sumidos = ((perfis ?? []) as Profile[])
    .map((perfil) => {
      const visto = ultima.get(perfil.id)
      return {
        perfil,
        diasSemAparecer: visto
          ? Math.round(
              (Date.parse(`${hoje}T12:00:00Z`) -
                Date.parse(`${visto}T12:00:00Z`)) /
                86_400_000
            )
          : null,
      }
    })
    .filter(
      (a) => a.diasSemAparecer === null || a.diasSemAparecer >= diasParaSumico
    )
    .sort((a, b) => (b.diasSemAparecer ?? 999) - (a.diasSemAparecer ?? 999))

  // ── Movimento por dia ───────────────────────────────────────────
  const porDiaMapa = new Map<string, Set<string>>()
  for (const c of lista) {
    const set = porDiaMapa.get(c.data) ?? new Set()
    set.add(c.aluno_id)
    porDiaMapa.set(c.data, set)
  }
  for (const e of execucoes ?? []) {
    const set = porDiaMapa.get(e.data) ?? new Set()
    set.add(e.aluno_id)
    porDiaMapa.set(e.data, set)
  }

  const porDia = Array.from(porDiaMapa.entries())
    .map(([data, alunos]) => ({ data, total: alunos.size }))
    .sort((a, b) => a.data.localeCompare(b.data))

  return {
    presentes,
    sumidos,
    porDia,
    totalNoMes: porDia
      .filter((d) => d.data >= inicioMes)
      .reduce((soma, d) => soma + d.total, 0),
  }
}
