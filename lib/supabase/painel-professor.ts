import type {
  AlertaProfessor,
  Anamnese,
  AvaliacaoFisica,
  Checkin,
  HumorTipo,
  Indicador,
  Medicamento,
  Profile,
  SemaforoStatus,
} from '@/lib/types'
import {
  diaSemanaAtual,
  ehHoje,
  hojeISO,
  horaAtual,
  somarDiasISO,
} from '@/lib/utils/datas'
import type { PerguntaAnamnese } from '@/lib/utils/anamnese'
import { resumirIndicador, type RegistroIndicador } from '@/lib/utils/indicadores'
import { getPerguntasAnamnese } from './anamnese'
import { createClient } from './server'

/** Depois de tantos dias sem aparecer, o aluno vira pauta do professor. */
import {
  DIAS_DE_HISTORICO_DE_PRESENCA,
  DIAS_PARA_ALERTA_DE_SUMICO,
} from '@/lib/utils/presenca'

export { DIAS_PARA_ALERTA_DE_SUMICO, DIAS_DE_HISTORICO_DE_PRESENCA }

export interface AlunoNoPainel {
  perfil: Profile
  status: SemaforoStatus
  ultimoIndicador: RegistroIndicador | null
  humorHoje: HumorTipo | null
  treinouHoje: boolean
  temTreinoHoje: boolean
  presenteAgora: boolean
  /** `null` quando nunca apareceu. */
  diasSemAparecer: number | null
  dosesPendentes: number
  alertasAbertos: number
}

export interface PainelProfessorData {
  alunos: AlunoNoPainel[]
  alertas: AlertaProfessor[]
  presentes: Checkin[]
  hoje: string
  resumo: {
    total: number
    criticos: number
    atencao: number
    treinaramHoje: number
    sumidos: number
  }
}

/**
 * O pior sinal do aluno vira a cor do card: um indicador vermelho pesa mais
 * que um humor ruim, e humor ruim pesa mais que medicamento pendente.
 */
function piorStatus(...candidatos: (SemaforoStatus | null)[]): SemaforoStatus {
  if (candidatos.includes('vermelho')) return 'vermelho'
  if (candidatos.includes('amarelo')) return 'amarelo'
  return 'verde'
}

export async function getPainelProfessor(
  professorId: string
): Promise<PainelProfessorData> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const agora = horaAtual()
  const diaSemana = diaSemanaAtual()
  /*
    A janela de busca precisa ser MAIOR que o critério de sumiço, senão o
    aluno some da consulta exatamente quando passa a interessar: quem faltou
    seis dias não aparece numa busca de cinco, cai como "nunca treinou" e
    nunca entra na conta de sumidos. Noventa dias cobrem a viagem longa e a
    cirurgia sem trazer histórico demais.
  */
  const limiteHistoricoPresenca = somarDiasISO(hoje, -DIAS_DE_HISTORICO_DE_PRESENCA)

  const [
    { data: perfis },
    { data: indicadores },
    { data: humores },
    { data: execucoes },
    { data: treinos },
    { data: medicamentos },
    { data: confirmacoes },
    { data: checkins },
    { data: alertas },
    { data: avaliacoes },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'aluno')
      .order('nome', { ascending: true }),
    // 30 dias cobrem o "último indicador" de qualquer aluno ativo.
    supabase
      .from('indicadores')
      .select('*')
      .gte('created_at', `${somarDiasISO(hoje, -30)}T00:00:00`)
      .order('created_at', { ascending: false }),
    supabase.from('humor_diario').select('aluno_id, humor').eq('data', hoje),
    supabase
      .from('treino_execucoes')
      .select('aluno_id, data, concluido')
      .gte('data', limiteHistoricoPresenca),
    supabase.from('treinos').select('aluno_id, dia_semana').eq('ativo', true),
    supabase
      .from('medicamentos')
      .select('id, aluno_id, horarios, dias_semana')
      .eq('ativo', true),
    supabase
      .from('medicamento_confirmacoes')
      .select('medicamento_id, horario, status')
      .eq('data', hoje),
    supabase
      .from('checkins')
      .select('*, aluno:profiles!checkins_aluno_id_fkey(id, nome, foto_url)')
      .gte('data', limiteHistoricoPresenca)
      .order('entrada', { ascending: false }),
    supabase
      .from('alertas_professor')
      .select('*, aluno:profiles!alertas_professor_aluno_id_fkey(id, nome, foto_url)')
      .eq('professor_id', professorId)
      .eq('resolvido', false)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('avaliacoes_fisicas').select('aluno_id, altura, data'),
  ])

  const alunos = (perfis ?? []) as Profile[]

  // ── Altura mais recente por aluno (o peso vira IMC com ela) ─────
  const alturaPorAluno = new Map<string, number>()
  for (const a of (avaliacoes ?? []) as {
    aluno_id: string
    altura: number | null
    data: string
  }[]) {
    if (a.altura == null) continue
    if (!alturaPorAluno.has(a.aluno_id)) alturaPorAluno.set(a.aluno_id, a.altura)
  }

  // ── Último indicador por aluno ──────────────────────────────────
  const ultimoPorAluno = new Map<string, RegistroIndicador>()
  for (const bruto of (indicadores ?? []) as Indicador[]) {
    if (ultimoPorAluno.has(bruto.aluno_id)) continue
    ultimoPorAluno.set(
      bruto.aluno_id,
      resumirIndicador(bruto, alturaPorAluno.get(bruto.aluno_id) ?? null)
    )
  }

  const humorPorAluno = new Map(
    (humores ?? []).map((h) => [h.aluno_id, h.humor as HumorTipo])
  )

  // ── Treino e frequência ─────────────────────────────────────────
  const treinouHoje = new Set(
    (execucoes ?? [])
      .filter((e) => e.data === hoje && e.concluido)
      .map((e) => e.aluno_id)
  )

  const temTreinoHoje = new Set(
    (treinos ?? [])
      .filter((t) => ehHoje(t.dia_semana, diaSemana))
      .map((t) => t.aluno_id)
  )

  // ── Presença ────────────────────────────────────────────────────
  type CheckinRow = Omit<Checkin, 'aluno'> & {
    aluno: Profile | Profile[] | null
  }

  const listaCheckins = ((checkins ?? []) as CheckinRow[]).map((c) => ({
    ...c,
    aluno: (Array.isArray(c.aluno) ? c.aluno[0] : c.aluno) ?? undefined,
  })) as Checkin[]

  const presentes = listaCheckins.filter((c) => c.data === hoje && !c.saida)
  const idsPresentes = new Set(presentes.map((c) => c.aluno_id))

  const ultimaPresenca = new Map<string, string>()
  for (const c of listaCheckins) {
    if (!ultimaPresenca.has(c.aluno_id)) ultimaPresenca.set(c.aluno_id, c.data)
  }
  // Treino registrado também conta como presença.
  for (const e of execucoes ?? []) {
    const atual = ultimaPresenca.get(e.aluno_id)
    if (!atual || e.data > atual) ultimaPresenca.set(e.aluno_id, e.data)
  }

  // ── Doses vencidas e não confirmadas ────────────────────────────
  const confirmadas = new Set(
    (confirmacoes ?? [])
      .filter((c) => c.status === 'tomou' && c.horario)
      .map((c) => `${c.medicamento_id}:${c.horario}`)
  )

  const pendentesPorAluno = new Map<string, number>()
  for (const med of (medicamentos ?? []) as {
    id: string
    aluno_id: string
    horarios: string[] | null
    dias_semana: string[] | null
  }[]) {
    if (!ehHoje(med.dias_semana, diaSemana)) continue

    for (const bruto of med.horarios ?? []) {
      const horario = bruto.slice(0, 5)
      if (horario > agora) continue
      if (confirmadas.has(`${med.id}:${horario}`)) continue

      pendentesPorAluno.set(
        med.aluno_id,
        (pendentesPorAluno.get(med.aluno_id) ?? 0) + 1
      )
    }
  }

  // ── Alertas ─────────────────────────────────────────────────────
  type AlertaRow = Omit<AlertaProfessor, 'aluno'> & {
    aluno: Profile | Profile[] | null
  }

  const listaAlertas = ((alertas ?? []) as AlertaRow[]).map((a) => ({
    ...a,
    aluno: (Array.isArray(a.aluno) ? a.aluno[0] : a.aluno) ?? undefined,
  })) as AlertaProfessor[]

  const alertasPorAluno = new Map<string, number>()
  for (const a of listaAlertas) {
    alertasPorAluno.set(a.aluno_id, (alertasPorAluno.get(a.aluno_id) ?? 0) + 1)
  }

  // ── Montagem ────────────────────────────────────────────────────
  const montados: AlunoNoPainel[] = alunos.map((perfil) => {
    const ultimoIndicador = ultimoPorAluno.get(perfil.id) ?? null
    const humor = humorPorAluno.get(perfil.id) ?? null
    const dosesPendentes = pendentesPorAluno.get(perfil.id) ?? 0

    const visto = ultimaPresenca.get(perfil.id) ?? null
    const diasSemAparecer = visto
      ? Math.round(
          (Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${visto}T12:00:00Z`)) /
            86_400_000
        )
      : null

    const statusHumor: SemaforoStatus | null =
      humor === 'enfermo' ? 'vermelho' : humor === 'ansioso' ? 'amarelo' : null

    const statusFrequencia: SemaforoStatus | null =
      diasSemAparecer !== null && diasSemAparecer >= DIAS_PARA_ALERTA_DE_SUMICO
        ? 'amarelo'
        : null

    return {
      perfil,
      status: piorStatus(
        ultimoIndicador?.status ?? null,
        statusHumor,
        statusFrequencia,
        dosesPendentes > 0 ? 'amarelo' : null
      ),
      ultimoIndicador,
      humorHoje: humor,
      treinouHoje: treinouHoje.has(perfil.id),
      temTreinoHoje: temTreinoHoje.has(perfil.id),
      presenteAgora: idsPresentes.has(perfil.id),
      diasSemAparecer,
      dosesPendentes,
      alertasAbertos: alertasPorAluno.get(perfil.id) ?? 0,
    }
  })

  // Quem precisa de atenção primeiro sobe para o topo da lista.
  const peso: Record<SemaforoStatus, number> = {
    vermelho: 0,
    amarelo: 1,
    verde: 2,
  }
  montados.sort(
    (a, b) =>
      peso[a.status] - peso[b.status] ||
      a.perfil.nome.localeCompare(b.perfil.nome)
  )

  return {
    alunos: montados,
    alertas: listaAlertas,
    presentes,
    hoje,
    resumo: {
      total: montados.length,
      criticos: montados.filter((a) => a.status === 'vermelho').length,
      atencao: montados.filter((a) => a.status === 'amarelo').length,
      treinaramHoje: montados.filter((a) => a.treinouHoje).length,
      sumidos: montados.filter(
        (a) =>
          a.diasSemAparecer !== null &&
          a.diasSemAparecer >= DIAS_PARA_ALERTA_DE_SUMICO
      ).length,
    },
  }
}

// ============================================================
// Detalhe de um aluno
// ============================================================

export interface DetalheAluno {
  perfil: Profile
  indicadores: RegistroIndicador[]
  humores: { data: string; humor: HumorTipo; observacao: string | null }[]
  treinos: { id: string; nome: string; diaSemana: string[]; ativo: boolean }[]
  medicamentos: Medicamento[]
  avaliacoes: AvaliacaoFisica[]
  anamnese: Anamnese | null
  /** Inclui as arquivadas: resposta antiga continua aparecendo na ficha. */
  perguntasAnamnese: PerguntaAnamnese[]
  checkins: Checkin[]
  /** Treinos concluídos nos últimos 30 dias. */
  treinosNoMes: number
  esforcoMedio: number | null
  ultimaPresenca: string | null
  altura: number | null
}

export async function getDetalheAluno(
  alunoId: string
): Promise<DetalheAluno | null> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const inicio = somarDiasISO(hoje, -30)

  const [
    { data: perfil },
    { data: indicadores },
    { data: humores },
    { data: treinos },
    { data: medicamentos },
    { data: avaliacoes },
    { data: anamnese },
    { data: checkins },
    { data: execucoes },
    { perguntas: perguntasAnamnese },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', alunoId).maybeSingle(),
    supabase
      .from('indicadores')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('humor_diario')
      .select('data, humor, observacao')
      .eq('aluno_id', alunoId)
      .gte('data', inicio)
      .order('data', { ascending: false }),
    supabase
      .from('treinos')
      .select('id, nome, dia_semana, ativo')
      .eq('aluno_id', alunoId)
      .order('created_at', { ascending: false }),
    supabase
      .from('medicamentos')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('nome', { ascending: true }),
    supabase
      .from('avaliacoes_fisicas')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('data', { ascending: false }),
    supabase
      .from('anamneses')
      .select('*')
      .eq('aluno_id', alunoId)
      .maybeSingle(),
    supabase
      .from('checkins')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('data', { ascending: false })
      .limit(60),
    supabase
      .from('treino_execucoes')
      .select('data, concluido, esforco_percebido')
      .eq('aluno_id', alunoId)
      .gte('data', inicio),
    getPerguntasAnamnese(supabase, { incluirArquivadas: true }),
  ])

  if (!perfil) return null

  const listaAvaliacoes = (avaliacoes ?? []) as AvaliacaoFisica[]
  const altura = listaAvaliacoes.find((a) => a.altura)?.altura ?? null

  const concluidos = (execucoes ?? []).filter((e) => e.concluido)
  const esforcos = (execucoes ?? [])
    .map((e) => e.esforco_percebido)
    .filter((v): v is number => typeof v === 'number')

  const listaCheckins = (checkins ?? []) as Checkin[]

  return {
    perfil: perfil as Profile,
    indicadores: ((indicadores ?? []) as Indicador[]).map((i) =>
      resumirIndicador(i, altura)
    ),
    humores: (humores ?? []).map((h) => ({
      data: h.data,
      humor: h.humor as HumorTipo,
      observacao: h.observacao ?? null,
    })),
    treinos: (treinos ?? []).map((t) => ({
      id: t.id,
      nome: t.nome,
      diaSemana: t.dia_semana ?? [],
      ativo: t.ativo,
    })),
    medicamentos: (medicamentos ?? []) as Medicamento[],
    avaliacoes: listaAvaliacoes,
    anamnese: (anamnese as Anamnese | null) ?? null,
    perguntasAnamnese,
    checkins: listaCheckins,
    treinosNoMes: concluidos.length,
    esforcoMedio:
      esforcos.length > 0
        ? esforcos.reduce((s, v) => s + v, 0) / esforcos.length
        : null,
    ultimaPresenca:
      [
        listaCheckins[0]?.data,
        concluidos.map((e) => e.data).sort().reverse()[0],
      ]
        .filter(Boolean)
        .sort()
        .reverse()[0] ?? null,
    altura,
  }
}
