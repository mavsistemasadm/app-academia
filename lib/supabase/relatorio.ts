import type {
  Anamnese,
  AvaliacaoFisica,
  HumorTipo,
  Indicador,
  IndicadorTipo,
  Profile,
} from '@/lib/types'
import { hojeISO, somarDiasISO } from '@/lib/utils/datas'
import type { PerguntaAnamnese } from '@/lib/utils/anamnese'
import { resumirIndicador, type RegistroIndicador } from '@/lib/utils/indicadores'
import { getPerguntasAnamnese } from './anamnese'
import { createClient } from './server'

export interface ResumoIndicadorMes {
  tipo: IndicadorTipo
  medicoes: number
  media: number
  mediaSecundaria: number | null
  minimo: number
  maximo: number
  verdes: number
  amarelos: number
  vermelhos: number
}

export interface RelatorioMensal {
  perfil: Profile
  /** `YYYY-MM`. */
  mes: string
  inicio: string
  fim: string
  indicadores: ResumoIndicadorMes[]
  registros: RegistroIndicador[]
  treinosPrevistos: number
  treinosFeitos: number
  presencas: number
  esforcoMedio: number | null
  adesaoMedicamento: { previstas: number; confirmadas: number }
  humor: { tipo: HumorTipo; dias: number }[]
  diasComHumor: number
  avaliacoes: AvaliacaoFisica[]
  anamnese: Anamnese | null
  /** Só as marcadas pelo professor para ir ao médico. */
  perguntasAnamnese: PerguntaAnamnese[]
  altura: number | null
}

/** Último dia do mês `YYYY-MM`, sem depender de biblioteca de datas. */
function fimDoMes(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number)
  // Dia 0 do mês seguinte é o último dia deste.
  const data = new Date(Date.UTC(ano, numero, 0))
  return data.toISOString().slice(0, 10)
}

export async function getRelatorioMensal(
  perfil: Profile,
  mes = hojeISO().slice(0, 7)
): Promise<RelatorioMensal> {
  const supabase = await createClient()

  const inicio = `${mes}-01`
  const fim = fimDoMes(mes)

  const [
    { data: indicadores },
    { data: execucoes },
    { data: treinos },
    { data: checkins },
    { data: confirmacoes },
    { data: medicamentos },
    { data: humores },
    { data: avaliacoes },
    { data: anamnese },
    { perguntas },
  ] = await Promise.all([
    supabase
      .from('indicadores')
      .select('*')
      .eq('aluno_id', perfil.id)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fim}T23:59:59`)
      .order('created_at', { ascending: true }),
    supabase
      .from('treino_execucoes')
      .select('data, concluido, esforco_percebido')
      .eq('aluno_id', perfil.id)
      .gte('data', inicio)
      .lte('data', fim),
    supabase
      .from('treinos')
      .select('dia_semana')
      .eq('aluno_id', perfil.id)
      .eq('ativo', true),
    supabase
      .from('checkins')
      .select('data')
      .eq('aluno_id', perfil.id)
      .gte('data', inicio)
      .lte('data', fim),
    supabase
      .from('medicamento_confirmacoes')
      .select('status')
      .eq('aluno_id', perfil.id)
      .gte('data', inicio)
      .lte('data', fim),
    supabase
      .from('medicamentos')
      .select('horarios')
      .eq('aluno_id', perfil.id)
      .eq('ativo', true),
    supabase
      .from('humor_diario')
      .select('humor')
      .eq('aluno_id', perfil.id)
      .gte('data', inicio)
      .lte('data', fim),
    supabase
      .from('avaliacoes_fisicas')
      .select('*')
      .eq('aluno_id', perfil.id)
      .order('data', { ascending: false })
      .limit(3),
    supabase
      .from('anamneses')
      .select('*')
      .eq('aluno_id', perfil.id)
      .maybeSingle(),
    getPerguntasAnamnese(supabase),
  ])

  const listaAvaliacoes = (avaliacoes ?? []) as AvaliacaoFisica[]
  const altura = listaAvaliacoes.find((a) => a.altura)?.altura ?? null

  const registros = ((indicadores ?? []) as Indicador[]).map((i) =>
    resumirIndicador(i, altura)
  )

  // ── Resumo por tipo ─────────────────────────────────────────────
  const porTipo = new Map<IndicadorTipo, RegistroIndicador[]>()
  for (const registro of registros) {
    const atuais = porTipo.get(registro.tipo) ?? []
    atuais.push(registro)
    porTipo.set(registro.tipo, atuais)
  }

  const resumoIndicadores: ResumoIndicadorMes[] = Array.from(
    porTipo.entries()
  ).map(([tipo, lista]) => {
    const valores = lista.map((r) => r.valorPrincipal)
    const secundarios = lista
      .map((r) => r.valorSecundario)
      .filter((v): v is number => v != null)

    return {
      tipo,
      medicoes: lista.length,
      media: valores.reduce((s, v) => s + v, 0) / valores.length,
      mediaSecundaria:
        secundarios.length > 0
          ? secundarios.reduce((s, v) => s + v, 0) / secundarios.length
          : null,
      minimo: Math.min(...valores),
      maximo: Math.max(...valores),
      verdes: lista.filter((r) => r.status === 'verde').length,
      amarelos: lista.filter((r) => r.status === 'amarelo').length,
      vermelhos: lista.filter((r) => r.status === 'vermelho').length,
    }
  })

  // ── Treino previsto no mês ──────────────────────────────────────
  const diasPrevistos = new Set<string>()
  for (const t of treinos ?? []) {
    for (const d of (t.dia_semana ?? []) as string[]) {
      diasPrevistos.add(d.toLowerCase().slice(0, 3))
    }
  }

  let treinosPrevistos = 0
  for (
    let dia = inicio;
    dia <= fim && dia <= hojeISO();
    dia = somarDiasISO(dia, 1)
  ) {
    const nomeDia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][
      new Date(`${dia}T12:00:00Z`).getUTCDay()
    ]
    if (diasPrevistos.size === 0 || diasPrevistos.has(nomeDia)) {
      treinosPrevistos += 1
    }
  }

  const feitos = (execucoes ?? []).filter((e) => e.concluido)
  const esforcos = (execucoes ?? [])
    .map((e) => e.esforco_percebido)
    .filter((v): v is number => typeof v === 'number')

  // ── Adesão a medicamento ────────────────────────────────────────
  const dosesPorDia = (medicamentos ?? []).reduce(
    (soma, m) => soma + ((m.horarios as string[] | null)?.length ?? 0),
    0
  )
  const diasDecorridos = Math.min(
    Number(fim.slice(8)),
    Number(hojeISO() >= fim ? fim.slice(8) : hojeISO().slice(8))
  )

  // ── Humor ───────────────────────────────────────────────────────
  const contagemHumor = new Map<HumorTipo, number>()
  for (const h of humores ?? []) {
    const tipo = h.humor as HumorTipo
    contagemHumor.set(tipo, (contagemHumor.get(tipo) ?? 0) + 1)
  }

  return {
    perfil,
    mes,
    inicio,
    fim,
    indicadores: resumoIndicadores,
    registros,
    treinosPrevistos,
    treinosFeitos: feitos.length,
    presencas: new Set([
      ...(checkins ?? []).map((c) => c.data as string),
      ...feitos.map((e) => e.data as string),
    ]).size,
    esforcoMedio:
      esforcos.length > 0
        ? esforcos.reduce((s, v) => s + v, 0) / esforcos.length
        : null,
    adesaoMedicamento: {
      previstas: dosesPorDia * diasDecorridos,
      confirmadas: (confirmacoes ?? []).filter((c) => c.status === 'tomou')
        .length,
    },
    humor: Array.from(contagemHumor.entries())
      .map(([tipo, dias]) => ({ tipo, dias }))
      .sort((a, b) => b.dias - a.dias),
    diasComHumor: (humores ?? []).length,
    avaliacoes: listaAvaliacoes,
    anamnese: (anamnese as Anamnese | null) ?? null,
    perguntasAnamnese: perguntas.filter((p) => p.no_relatorio),
    altura,
  }
}
