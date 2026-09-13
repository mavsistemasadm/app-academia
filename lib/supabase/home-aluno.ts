import type {
  HumorTipo,
  Indicador,
  IndicadorTipo,
  Profile,
  SaudacaoData,
  TreinoExecucao,
} from '@/lib/types'
import { duracaoDaExecucao } from '@/lib/utils/duracao'
import { gerarSaudacao } from '@/lib/utils/saudacao'
import {
  diaSemanaAtual,
  ehHoje,
  hojeISO,
  horaAtual,
  inicioDaSemanaISO,
} from '@/lib/utils/datas'
import {
  resumirIndicador,
  type RegistroIndicador,
} from '@/lib/utils/indicadores'
import { createClient } from './server'

export interface RemedioPendente {
  medicamentoId: string
  nome: string
  dose?: string
  horario: string
}

export interface TreinoHoje {
  id: string
  nome: string
  totalExercicios: number
  iniciado: boolean
  concluido: boolean
  totalSeries: number
  seriesFeitas: number
  /** Tempo do treino concluído hoje, em segundos (migração 008 ou estimado). */
  duracaoSegundos?: number | null
}

export interface ProximoEvento {
  titulo: string
  dataInicio: string
}

export interface HomeAlunoData {
  perfil: Profile
  hoje: string
  saudacao: SaudacaoData
  indicadores: Partial<Record<IndicadorTipo, RegistroIndicador>>
  treinosNaSemana: number
  treinosPlanejados: number
  remediosPendentes: RemedioPendente[]
  treinoHoje: TreinoHoje | null
  humorHoje: HumorTipo | null
  totalIndicadores: number
  proximoEvento: ProximoEvento | null
}

interface MedicamentoRow {
  id: string
  nome: string
  dose: string | null
  horarios: string[] | null
  dias_semana: string[] | null
}

interface TreinoRow {
  id: string
  nome: string
  dia_semana: string[] | null
  exercicios: { id: string; series: number | null }[] | null
}

export async function getHomeAluno(perfil: Profile): Promise<HomeAlunoData> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const agora = horaAtual()
  const diaSemana = diaSemanaAtual()
  const inicioSemana = inicioDaSemanaISO()

  const [
    { data: indicadoresRaw },
    { data: avaliacao },
    { data: medicamentos },
    { data: confirmacoes },
    { data: treinos },
    { data: execucoesSemana },
    { data: humor },
    { data: eventos },
  ] = await Promise.all([
    // Últimos registros; o mais recente de cada tipo é escolhido abaixo.
    supabase
      .from('indicadores')
      .select('*')
      .eq('aluno_id', perfil.id)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('avaliacoes_fisicas')
      .select('altura')
      .eq('aluno_id', perfil.id)
      .not('altura', 'is', null)
      .order('data', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('medicamentos')
      .select('id, nome, dose, horarios, dias_semana')
      .eq('aluno_id', perfil.id)
      .eq('ativo', true),
    supabase
      .from('medicamento_confirmacoes')
      .select('medicamento_id, horario, status')
      .eq('aluno_id', perfil.id)
      .eq('data', hoje),
    supabase
      .from('treinos')
      .select('id, nome, dia_semana, exercicios(id, series)')
      .eq('aluno_id', perfil.id)
      .eq('ativo', true),
    supabase
      .from('treino_execucoes')
      // `*` inclui as colunas de tempo da migração 008 quando existem.
      .select('*')
      .eq('aluno_id', perfil.id)
      .gte('data', inicioSemana),
    supabase
      .from('humor_diario')
      .select('humor')
      .eq('aluno_id', perfil.id)
      .eq('data', hoje)
      .maybeSingle(),
    supabase
      .from('eventos')
      .select('titulo, data_inicio')
      .gte('data_inicio', new Date().toISOString())
      .order('data_inicio', { ascending: true })
      .limit(1),
  ])

  // ── Indicadores: o mais recente de cada tipo ──────────────────────
  const listaIndicadores = (indicadoresRaw ?? []) as Indicador[]
  const altura = (avaliacao?.altura as number | undefined) ?? null

  const indicadores: Partial<Record<IndicadorTipo, RegistroIndicador>> = {}
  for (const indicador of listaIndicadores) {
    if (indicadores[indicador.tipo]) continue // já pegamos o mais recente
    indicadores[indicador.tipo] = resumirIndicador(indicador, altura)
  }

  // ── Remédios ainda não confirmados hoje ──────────────────────────
  // A confirmação guarda o horário previsto, então a dose é identificada
  // exatamente — sem chutar qual das tomadas do dia foi registrada.
  const resolvidas = new Set(
    (confirmacoes ?? [])
      .filter((c) => c.horario)
      .map((c) => `${c.medicamento_id}:${c.horario}`)
  )

  const remediosPendentes: RemedioPendente[] = []
  for (const med of (medicamentos ?? []) as MedicamentoRow[]) {
    if (!ehHoje(med.dias_semana, diaSemana)) continue

    for (const bruto of med.horarios ?? []) {
      const horario = bruto.slice(0, 5)
      // Só cobra horário que já passou — remédio das 20h não é pendência às 14h.
      if (horario > agora) continue
      if (resolvidas.has(`${med.id}:${horario}`)) continue

      remediosPendentes.push({
        medicamentoId: med.id,
        nome: med.nome,
        dose: med.dose ?? undefined,
        horario,
      })
    }
  }

  remediosPendentes.sort((a, b) => a.horario.localeCompare(b.horario))

  // ── Treino de hoje e frequência da semana ────────────────────────
  const listaTreinos = (treinos ?? []) as TreinoRow[]
  const execucoes = (execucoesSemana ?? []) as TreinoExecucao[]

  const treinoDoDia = listaTreinos.find((t) => ehHoje(t.dia_semana, diaSemana))
  const execucaoHoje = treinoDoDia
    ? execucoes.find((e) => e.treino_id === treinoDoDia.id && e.data === hoje)
    : undefined

  // Séries marcadas hoje — a barra de progresso da home vem daqui, e os
  // horários delas estimam a duração quando a migração 008 não existe.
  const { data: seriesHoje } = execucaoHoje
    ? await supabase
        .from('exercicio_execucoes')
        .select('created_at')
        .eq('execucao_id', execucaoHoje.id)
    : { data: null }
  const horariosDasSeries = (seriesHoje ?? []).map((s) => s.created_at as string)
  const seriesFeitas = horariosDasSeries.length

  const treinoHoje: TreinoHoje | null = treinoDoDia
    ? {
        id: treinoDoDia.id,
        nome: treinoDoDia.nome,
        totalExercicios: treinoDoDia.exercicios?.length ?? 0,
        iniciado: Boolean(execucaoHoje),
        concluido: Boolean(execucaoHoje?.concluido),
        totalSeries: (treinoDoDia.exercicios ?? []).reduce(
          (soma, e) => soma + Math.max(1, e.series ?? 1),
          0
        ),
        seriesFeitas,
        duracaoSegundos: execucaoHoje?.concluido
          ? duracaoDaExecucao(execucaoHoje, horariosDasSeries)
          : null,
      }
    : null

  // Dias distintos previstos entre todos os treinos ativos.
  const diasPlanejados = new Set<string>()
  for (const t of listaTreinos) {
    for (const d of t.dia_semana ?? []) diasPlanejados.add(d.toLowerCase())
  }

  const treinosNaSemana = execucoes.filter((e) => e.concluido).length
  const humorHoje = (humor?.humor as HumorTipo | undefined) ?? null

  // `gerarSaudacao` pede as entidades completas; montamos o mínimo que ela lê.
  const saudacao = gerarSaudacao({
    profile: perfil,
    indicadores,
    treinosNaSemana,
    remediosPendentes: remediosPendentes.map((r) => ({
      id: r.medicamentoId,
      aluno_id: perfil.id,
      nome: r.nome,
      horarios: [r.horario],
      ativo: true,
      created_at: hoje,
    })),
    humorHoje: humorHoje
      ? {
          id: '',
          aluno_id: perfil.id,
          data: hoje,
          humor: humorHoje,
          created_at: hoje,
        }
      : undefined,
    treinoHoje: treinoDoDia
      ? {
          id: treinoDoDia.id,
          professor_id: '',
          aluno_id: perfil.id,
          nome: treinoDoDia.nome,
          dia_semana: treinoDoDia.dia_semana ?? [],
          ativo: true,
          created_at: hoje,
        }
      : undefined,
  })

  return {
    perfil,
    hoje,
    saudacao,
    indicadores,
    treinosNaSemana,
    treinosPlanejados: diasPlanejados.size,
    remediosPendentes,
    treinoHoje,
    humorHoje,
    totalIndicadores: listaIndicadores.length,
    proximoEvento: eventos?.[0]
      ? { titulo: eventos[0].titulo, dataInicio: eventos[0].data_inicio }
      : null,
  }
}
