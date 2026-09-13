import type { Medicamento, MedicamentoStatus } from '@/lib/types'
import { diaSemanaAtual, ehHoje, hojeISO, horaAtual } from '@/lib/utils/datas'
import { createClient } from './server'

export type SituacaoDose = 'tomada' | 'pulada' | 'adiada' | 'atrasada' | 'aguardando'

export interface Dose {
  medicamentoId: string
  nome: string
  dose: string | null
  fotoUrl: string | null
  /** `HH:MM`. */
  horario: string
  situacao: SituacaoDose
  motivo: string | null
}

export interface RemediosAlunoData {
  medicamentos: Medicamento[]
  /** As doses de hoje, em ordem de horário. */
  doses: Dose[]
  hoje: string
  agora: string
  /** Quantas doses previstas para hoje já foram confirmadas. */
  tomadas: number
}

function situacaoDe(
  status: MedicamentoStatus | undefined,
  horario: string,
  agora: string
): SituacaoDose {
  if (status === 'tomou') return 'tomada'
  if (status === 'nao_tomou') return 'pulada'
  if (status === 'adiou') return 'adiada'
  return horario <= agora ? 'atrasada' : 'aguardando'
}

export async function getRemediosAluno(
  alunoId: string
): Promise<RemediosAlunoData> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const agora = horaAtual()
  const diaSemana = diaSemanaAtual()

  const [{ data: medicamentos }, { data: confirmacoes }] = await Promise.all([
    supabase
      .from('medicamentos')
      .select('*')
      .eq('aluno_id', alunoId)
      .order('nome', { ascending: true }),
    supabase
      .from('medicamento_confirmacoes')
      .select('medicamento_id, horario, status, motivo')
      .eq('aluno_id', alunoId)
      .eq('data', hoje),
  ])

  const lista = (medicamentos ?? []) as Medicamento[]

  const porDose = new Map<
    string,
    { status: MedicamentoStatus; motivo: string | null }
  >()
  for (const c of confirmacoes ?? []) {
    if (!c.horario) continue
    porDose.set(`${c.medicamento_id}:${c.horario}`, {
      status: c.status as MedicamentoStatus,
      motivo: c.motivo ?? null,
    })
  }

  const doses: Dose[] = []
  for (const med of lista) {
    if (!med.ativo) continue
    if (!ehHoje(med.dias_semana, diaSemana)) continue

    for (const bruto of med.horarios ?? []) {
      const horario = bruto.slice(0, 5)
      const registro = porDose.get(`${med.id}:${horario}`)

      doses.push({
        medicamentoId: med.id,
        nome: med.nome,
        dose: med.dose ?? null,
        fotoUrl: med.foto_url ?? null,
        horario,
        situacao: situacaoDe(registro?.status, horario, agora),
        motivo: registro?.motivo ?? null,
      })
    }
  }

  doses.sort((a, b) => a.horario.localeCompare(b.horario))

  return {
    medicamentos: lista,
    doses,
    hoje,
    agora,
    tomadas: doses.filter((d) => d.situacao === 'tomada').length,
  }
}

export interface AdesaoAluno {
  alunoId: string
  nome: string
  previstas: number
  confirmadas: number
  pendentes: Dose[]
}

/**
 * Quem ainda não confirmou o remédio de hoje — a pergunta que o professor faz
 * antes do treino. Roda com a visão do professor (policies da migração 004).
 */
export async function getAdesaoDoDia(): Promise<AdesaoAluno[]> {
  const supabase = await createClient()

  const hoje = hojeISO()
  const agora = horaAtual()
  const diaSemana = diaSemanaAtual()

  const [{ data: medicamentos }, { data: confirmacoes }] = await Promise.all([
    supabase
      .from('medicamentos')
      .select('*, aluno:profiles!medicamentos_aluno_id_fkey(id, nome)')
      .eq('ativo', true),
    supabase
      .from('medicamento_confirmacoes')
      .select('medicamento_id, horario, status')
      .eq('data', hoje),
  ])

  type Row = Medicamento & {
    aluno: { id: string; nome: string } | { id: string; nome: string }[] | null
  }

  const confirmadas = new Set(
    (confirmacoes ?? [])
      .filter((c) => c.status === 'tomou' && c.horario)
      .map((c) => `${c.medicamento_id}:${c.horario}`)
  )

  const porAluno = new Map<string, AdesaoAluno>()

  for (const med of (medicamentos ?? []) as Row[]) {
    if (!ehHoje(med.dias_semana, diaSemana)) continue

    const aluno = Array.isArray(med.aluno) ? med.aluno[0] : med.aluno
    if (!aluno) continue

    const atual = porAluno.get(aluno.id) ?? {
      alunoId: aluno.id,
      nome: aluno.nome,
      previstas: 0,
      confirmadas: 0,
      pendentes: [],
    }

    for (const bruto of med.horarios ?? []) {
      const horario = bruto.slice(0, 5)
      // Só conta o que já venceu: remédio das 20h não é pendência às 14h.
      if (horario > agora) continue

      atual.previstas += 1

      if (confirmadas.has(`${med.id}:${horario}`)) {
        atual.confirmadas += 1
      } else {
        atual.pendentes.push({
          medicamentoId: med.id,
          nome: med.nome,
          dose: med.dose ?? null,
          fotoUrl: med.foto_url ?? null,
          horario,
          situacao: 'atrasada',
          motivo: null,
        })
      }
    }

    porAluno.set(aluno.id, atual)
  }

  return Array.from(porAluno.values())
    .filter((a) => a.previstas > 0)
    .sort((a, b) => b.pendentes.length - a.pendentes.length)
}
