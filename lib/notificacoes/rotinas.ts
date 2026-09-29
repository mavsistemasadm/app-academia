import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { getConquistasAluno } from '@/lib/supabase/conquistas'
import { createServiceClient } from '@/lib/supabase/servico'
import {
  diaSemanaAtual,
  ehHoje,
  hojeISO,
  somarDiasISO,
} from '@/lib/utils/datas'
import {
  DIAS_DE_HISTORICO_DE_PRESENCA,
  DIAS_PARA_ALERTA_DE_SUMICO,
} from '@/lib/utils/presenca'

/**
 * Tarefas de uma vez por dia (ou por semana, ou por mês) que o cron de 15
 * minutos chama numa hora fixa. Cada uma é segura para rodar mais de uma vez:
 * a chave em `notificacoes_usuario` e a checagem de alerta aberto impedem
 * aviso repetido quando o cron passa quatro vezes na mesma hora.
 */

type Servico = ReturnType<typeof createServiceClient>

const META_AGUA_PADRAO_ML = 2000

interface Aluno {
  id: string
  nome: string
  meta_agua_ml: number | null
}

async function alunosAtivos(supabase: Servico): Promise<Aluno[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, nome, meta_agua_ml, ativo')
    .eq('role', 'aluno')
  return ((data ?? []) as (Aluno & { ativo: boolean | null })[]).filter((a) => a.ativo !== false)
}

async function professorResponsavel(supabase: Servico, alunoId: string) {
  const { data } = await supabase.rpc('professor_responsavel', { p_aluno_id: alunoId })
  return (data as string | null) ?? null
}

async function notificar(
  supabase: Servico,
  usuarioId: string,
  aviso: {
    tipo: string
    titulo: string
    corpo: string
    url: string
    canais: ('sino' | 'push' | 'email')[]
    chave: string
    urgente?: boolean
  }
) {
  const { error } = await supabase.rpc('notificar', {
    p_usuario: usuarioId,
    p_tipo: aviso.tipo,
    p_titulo: aviso.titulo,
    p_corpo: aviso.corpo,
    p_url: aviso.url,
    p_canais: aviso.canais,
    p_chave: aviso.chave,
    p_urgente: aviso.urgente ?? false,
  })
  if (error) console.error(`notificar ${aviso.tipo}:`, error.message)
}

function primeiroNome(nome: string | null | undefined) {
  return nome?.trim().split(/\s+/)[0] || 'Aluno'
}

function diasEntre(deISO: string, ateISO: string) {
  return Math.round((Date.parse(`${ateISO}T12:00:00Z`) - Date.parse(`${deISO}T12:00:00Z`)) / 86_400_000)
}

// ── Sumidos ─────────────────────────────────────────────────────────

export interface Sumido {
  aluno: Aluno
  dias: number
}

/**
 * Mesmo critério da tela de presença: última entrada ou treino concluído.
 * Quem nunca apareceu fica de fora do alerta: costuma ser aluno recém
 * convidado, e cobrar presença de quem ainda nem criou a senha não ajuda.
 */
export async function listarSumidos(supabase: Servico): Promise<Sumido[]> {
  const hoje = hojeISO()
  const inicio = somarDiasISO(hoje, -DIAS_DE_HISTORICO_DE_PRESENCA)

  const [alunos, { data: checkins }, { data: execucoes }] = await Promise.all([
    alunosAtivos(supabase),
    supabase.from('checkins').select('aluno_id, data').gte('data', inicio),
    supabase.from('treino_execucoes').select('aluno_id, data').eq('concluido', true).gte('data', inicio),
  ])

  const ultima = new Map<string, string>()
  for (const r of [...(checkins ?? []), ...(execucoes ?? [])] as { aluno_id: string; data: string }[]) {
    const atual = ultima.get(r.aluno_id)
    if (!atual || r.data > atual) ultima.set(r.aluno_id, r.data)
  }

  return alunos
    .map((aluno) => {
      const visto = ultima.get(aluno.id)
      return visto ? { aluno, dias: diasEntre(visto, hoje) } : null
    })
    .filter((s): s is Sumido => s !== null && s.dias >= DIAS_PARA_ALERTA_DE_SUMICO)
    .sort((a, b) => b.dias - a.dias)
}

/** Um alerta por sumiço: não repete enquanto houver um aberto ou recente. */
export async function alertarSumidos(supabase: Servico) {
  const sumidos = await listarSumidos(supabase)
  if (sumidos.length === 0) return 0

  const { data: recentes } = await supabase
    .from('alertas_professor')
    .select('aluno_id, resolvido, created_at')
    .eq('tipo', 'sem_treinar')
    .in('aluno_id', sumidos.map((s) => s.aluno.id))

  const umaSemana = Date.now() - 7 * 86_400_000
  const jaAvisados = new Set(
    (recentes ?? [])
      .filter((a) => !a.resolvido || Date.parse(a.created_at) > umaSemana)
      .map((a) => a.aluno_id as string)
  )

  let criados = 0
  for (const { aluno, dias } of sumidos) {
    if (jaAvisados.has(aluno.id)) continue
    const professor = await professorResponsavel(supabase, aluno.id)
    if (!professor) continue

    const { error } = await supabase.from('alertas_professor').insert({
      professor_id: professor,
      aluno_id: aluno.id,
      tipo: 'sem_treinar',
      mensagem: `Sem aparecer há ${dias} dias. Uma mensagem agora faz diferença.`,
      // A data entra no índice único da 019: um alerta por aluno por dia.
      dados: { dias, data: hojeISO() },
    })
    if (!error) criados += 1
  }
  return criados
}

// ── Doses esquecidas ────────────────────────────────────────────────

/** A partir de quantas doses sem confirmação num dia o professor é avisado. */
const DOSES_PARA_ALERTA = 2

/**
 * Olha o dia de ontem inteiro, que já fechou: doses previstas sem
 * confirmação de "tomou". O lembrete de push já saiu na hora de cada dose;
 * aqui é o professor que fica sabendo quando o esquecimento se acumula.
 */
export async function alertarDosesEsquecidas(supabase: Servico) {
  const ontem = somarDiasISO(hojeISO(), -1)
  const diaDeOntem = diaSemanaAtual(new Date(Date.now() - 86_400_000))

  const [{ data: medicamentos }, { data: confirmacoes }, { data: jaAlertados }] = await Promise.all([
    supabase
      .from('medicamentos')
      .select('id, aluno_id, nome, horarios, dias_semana, created_at')
      .eq('ativo', true),
    supabase
      .from('medicamento_confirmacoes')
      .select('medicamento_id, horario, status')
      .eq('data', ontem),
    supabase
      .from('alertas_professor')
      .select('aluno_id')
      .eq('tipo', 'medicamento_nao_tomado')
      .eq('dados->>data', ontem),
  ])

  const tomadas = new Set(
    (confirmacoes ?? [])
      .filter((c) => c.status === 'tomou' && c.horario)
      .map((c) => `${c.medicamento_id}:${String(c.horario).slice(0, 5)}`)
  )
  const avisados = new Set((jaAlertados ?? []).map((a) => a.aluno_id as string))

  const esquecidas = new Map<string, { total: number; nomes: Set<string> }>()
  for (const med of medicamentos ?? []) {
    if (!ehHoje(med.dias_semana, diaDeOntem)) continue
    // Cadastrado ontem ou hoje: as doses de antes do cadastro não contam.
    if (hojeISO(new Date(med.created_at)) >= ontem) continue

    for (const bruto of (med.horarios as string[] | null) ?? []) {
      if (tomadas.has(`${med.id}:${bruto.slice(0, 5)}`)) continue
      const atual = esquecidas.get(med.aluno_id) ?? { total: 0, nomes: new Set<string>() }
      atual.total += 1
      atual.nomes.add(med.nome)
      esquecidas.set(med.aluno_id, atual)
    }
  }

  let criados = 0
  for (const [alunoId, { total, nomes }] of esquecidas) {
    if (total < DOSES_PARA_ALERTA || avisados.has(alunoId)) continue
    const professor = await professorResponsavel(supabase, alunoId)
    if (!professor) continue

    const { error } = await supabase.from('alertas_professor').insert({
      professor_id: professor,
      aluno_id: alunoId,
      tipo: 'medicamento_nao_tomado',
      mensagem: `Ontem ficaram ${total} doses sem confirmação (${Array.from(nomes).join(', ')}).`,
      dados: { data: ontem, doses: total },
    })
    if (!error) criados += 1
  }
  return criados
}

// ── Conquistas e marcos (os e-mails que comemoram) ─────────────────

interface Marco {
  alvo: number
  titulo: string
  corpo: string
}

/*
  Os números redondos da jornada. Só o maior marco alcançado é comemorado:
  quem já tem 120 presenças quando isto entra no ar recebe o e-mail dos 100,
  não os de 10, 25 e 50 de uma vez. E, como os totais só crescem, os marcos
  de baixo nunca mais aparecem.
*/
const MARCOS_PRESENCA: Marco[] = [
  { alvo: 10, titulo: '10 presenças no centro', corpo: 'Dez vezes você escolheu vir. É assim que um hábito nasce: um dia de cada vez, e você já tem dez.' },
  { alvo: 25, titulo: '25 presenças: virou rotina', corpo: 'Vinte e cinco idas ao centro. A essa altura o corpo já sente a diferença, e a gente sente a sua presença por aqui.' },
  { alvo: 50, titulo: '50 presenças!', corpo: 'Cinquenta vezes pela porta do centro. Pouca gente chega aqui. Você chegou, e com constância, que é o que mais cuida da saúde.' },
  { alvo: 100, titulo: '100 presenças. Que marca!', corpo: 'Cem dias de cuidado com a sua saúde. Isso não é sorte, é decisão repetida cem vezes. A equipe inteira está orgulhosa.' },
  { alvo: 200, titulo: '200 presenças', corpo: 'Duzentas presenças. Você já é parte da história da Atitude Vital. Obrigado por confiar a sua saúde à gente.' },
  { alvo: 365, titulo: '365 presenças: um ano inteiro de cuidado', corpo: 'Trezentas e sessenta e cinco vezes. Um ano de presenças somadas. Poucas coisas dizem tanto sobre alguém quanto isso.' },
]

const MARCOS_TREINO: Marco[] = [
  { alvo: 1, titulo: 'Primeiro treino concluído!', corpo: 'O primeiro é o mais difícil, e ele já foi. A partir de agora cada treino conta a sua evolução no app.' },
  { alvo: 10, titulo: '10 treinos concluídos', corpo: 'Dez treinos do começo ao fim, série por série. Seu professor acompanha cada um deles.' },
  { alvo: 25, titulo: '25 treinos concluídos', corpo: 'Vinte e cinco treinos completos. A força, o fôlego e a disposição de agora já não são os do primeiro dia.' },
  { alvo: 50, titulo: '50 treinos concluídos!', corpo: 'Cinquenta treinos inteiros. Dá uma olhada na sua evolução no app: os números contam o que você já sente.' },
  { alvo: 100, titulo: '100 treinos concluídos', corpo: 'Cem treinos. Cem vezes em que você terminou o que começou. Isso vale para muito além do centro.' },
  { alvo: 200, titulo: '200 treinos concluídos', corpo: 'Duzentos treinos completos. Constância desse tamanho é o melhor remédio que existe.' },
]

const MARCOS_SEQUENCIA: Marco[] = [
  { alvo: 5, titulo: '5 dias seguidos!', corpo: 'Cinco dias seguidos cuidando de você. O embalo está do seu lado: amanhã tem mais.' },
  { alvo: 10, titulo: '10 dias seguidos', corpo: 'Dez dias sem falhar. Isso é disciplina de verdade, e ela aparece nos seus indicadores.' },
  { alvo: 20, titulo: '20 dias seguidos!', corpo: 'Vinte dias em sequência. Você transformou cuidado em rotina. Continue assim.' },
  { alvo: 30, titulo: '30 dias seguidos. Um mês inteiro!', corpo: 'Trinta dias sem parar. Um mês inteiro de sequência. A equipe da Atitude Vital tira o chapéu.' },
]

function maiorMarco(marcos: Marco[], valor: number) {
  return [...marcos].reverse().find((m) => valor >= m.alvo) ?? null
}

async function contar(supabase: Servico, tabela: 'checkins' | 'treino_execucoes', alunoId: string) {
  let consulta = supabase.from(tabela).select('id', { count: 'exact', head: true }).eq('aluno_id', alunoId)
  if (tabela === 'treino_execucoes') consulta = consulta.eq('concluido', true)
  const { count } = await consulta
  return count ?? 0
}

/**
 * Badge nova, marco de presença, de treino ou de sequência: sininho, push e
 * um e-mail com a marca comemorando. A chave de cada aviso garante que ele
 * sai uma vez só; na sequência a chave leva o dia em que ela começou, para
 * uma sequência nova de 10 dias ser comemorada de novo.
 */
export async function avisarConquistas(supabase: Servico) {
  const alunos = await alunosAtivos(supabase)
  const hoje = hojeISO()
  let avisos = 0

  for (const aluno of alunos) {
    const nome = primeiroNome(aluno.nome)
    const { conquistas, sequenciaAtual } = await getConquistasAluno(
      aluno.id,
      aluno.meta_agua_ml && aluno.meta_agua_ml > 0 ? aluno.meta_agua_ml : META_AGUA_PADRAO_ML,
      { supabase, marcarVistas: false }
    )

    const { data: registradas } = await supabase
      .from('aluno_conquistas')
      .select('chave')
      .eq('aluno_id', aluno.id)
    const jaTem = new Set((registradas ?? []).map((r) => r.chave as string))

    for (const c of conquistas.filter((c) => c.conquistada && !jaTem.has(c.chave))) {
      // A linha com vista = false faz a tela comemorar quando o aluno abrir.
      const { error } = await supabase
        .from('aluno_conquistas')
        .insert({ aluno_id: aluno.id, chave: c.chave, vista: false })
      if (error) continue

      await notificar(supabase, aluno.id, {
        tipo: 'conquista',
        titulo: `${nome}, conquista nova: ${c.titulo} ${c.emoji}`,
        corpo: `${c.descricao}\n\nCada conquista no app é um pedaço do cuidado que você tem com você. Parabéns, e bora para a próxima.`,
        url: '/conquistas',
        canais: ['sino', 'push', 'email'],
        chave: `conquista:${c.chave}`,
      })
      avisos += 1
    }

    const [presencas, treinos] = await Promise.all([
      contar(supabase, 'checkins', aluno.id),
      contar(supabase, 'treino_execucoes', aluno.id),
    ])

    const marcos: { marco: Marco; chave: string }[] = []
    const presenca = maiorMarco(MARCOS_PRESENCA, presencas)
    if (presenca) marcos.push({ marco: presenca, chave: `marco:presenca:${presenca.alvo}` })
    const treino = maiorMarco(MARCOS_TREINO, treinos)
    if (treino) marcos.push({ marco: treino, chave: `marco:treino:${treino.alvo}` })
    const sequencia = maiorMarco(MARCOS_SEQUENCIA, sequenciaAtual)
    if (sequencia) {
      const comecou = somarDiasISO(hoje, -(sequenciaAtual - 1))
      marcos.push({ marco: sequencia, chave: `marco:sequencia:${sequencia.alvo}:${comecou}` })
    }

    for (const { marco, chave } of marcos) {
      await notificar(supabase, aluno.id, {
        tipo: 'marco',
        titulo: `${nome}, ${marco.titulo.charAt(0).toLowerCase()}${marco.titulo.slice(1)}`,
        corpo: marco.corpo,
        url: '/conquistas',
        canais: ['sino', 'push', 'email'],
        chave,
      })
      avisos += 1
    }
  }
  return avisos
}

// ── Resumo semanal da equipe (segunda de manhã) ─────────────────────

export async function enviarResumoSemanal(supabase: Servico) {
  const hoje = hojeISO()
  const semanaPassada = somarDiasISO(hoje, -7)

  const [{ data: equipe }, sumidos, { data: criticos }, { data: checkins }] = await Promise.all([
    supabase.from('profiles').select('id, nome, ativo').eq('role', 'professor'),
    listarSumidos(supabase),
    supabase
      .from('alertas_professor')
      .select('professor_id')
      .eq('tipo', 'indicador_vermelho')
      .gte('created_at', `${semanaPassada}T03:00:00Z`),
    supabase.from('checkins').select('aluno_id').gte('data', semanaPassada).lt('data', hoje),
  ])

  // Cada professor recebe os sumidos pelos quais responde.
  const responsavel = new Map<string, string | null>()
  for (const s of sumidos) responsavel.set(s.aluno.id, await professorResponsavel(supabase, s.aluno.id))

  let enviados = 0
  for (const professor of (equipe ?? []).filter((p) => p.ativo !== false)) {
    const meus = sumidos.filter((s) => responsavel.get(s.aluno.id) === professor.id)
    const meusCriticos = (criticos ?? []).filter((a) => a.professor_id === professor.id).length

    if (meus.length === 0 && meusCriticos === 0) continue

    const linhas = meus.slice(0, 15).map((s) => `· ${s.aluno.nome}: ${s.dias} dias sem aparecer`)
    if (meus.length > 15) linhas.push(`· e mais ${meus.length - 15}`)

    const corpo = [
      `Na semana que passou foram ${(checkins ?? []).length} presenças no centro e ${meusCriticos} ${meusCriticos === 1 ? 'indicador crítico' : 'indicadores críticos'} entre os seus alunos.`,
      meus.length > 0
        ? `${meus.length === 1 ? 'Um aluno está sumido' : `${meus.length} alunos estão sumidos`} há ${DIAS_PARA_ALERTA_DE_SUMICO} dias ou mais:\n${linhas.join('\n')}`
        : 'Nenhum aluno seu está sumido. Boa semana!',
      meus.length > 0 ? 'Uma mensagem pelo chat do app costuma trazer de volta.' : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    await notificar(supabase, professor.id, {
      tipo: 'resumo_semanal',
      titulo: `${primeiroNome(professor.nome)}, o resumo da sua semana`,
      corpo,
      url: '/presenca',
      canais: ['email'],
      chave: `resumo-semanal:${hoje}`,
    })
    enviados += 1
  }
  return enviados
}

// ── Resumo mensal do aluno (dia 1) ──────────────────────────────────

export async function enviarResumoMensal(supabase: Servico) {
  const hoje = hojeISO()
  const fimMesPassado = somarDiasISO(`${hoje.slice(0, 7)}-01`, -1)
  const mes = fimMesPassado.slice(0, 7)
  const inicio = `${mes}-01`
  const nomeMes = format(new Date(`${inicio}T12:00:00Z`), 'MMMM', { locale: ptBR })

  const [alunos, { data: checkins }, { data: treinos }, { data: indicadores }] = await Promise.all([
    alunosAtivos(supabase),
    supabase.from('checkins').select('aluno_id').gte('data', inicio).lte('data', fimMesPassado),
    supabase
      .from('treino_execucoes')
      .select('aluno_id')
      .eq('concluido', true)
      .gte('data', inicio)
      .lte('data', fimMesPassado),
    supabase
      .from('indicadores')
      .select('aluno_id, status_semaforo')
      .gte('created_at', `${inicio}T03:00:00Z`)
      .lt('created_at', `${hoje.slice(0, 7)}-01T03:00:00Z`),
  ])

  const contar = (linhas: { aluno_id: string }[] | null, id: string) =>
    (linhas ?? []).filter((l) => l.aluno_id === id).length

  let enviados = 0
  for (const aluno of alunos) {
    const presencas = contar(checkins, aluno.id)
    const treinosFeitos = contar(treinos, aluno.id)
    const meus = (indicadores ?? []).filter((i) => i.aluno_id === aluno.id)
    const verdes = meus.filter((i) => i.status_semaforo === 'verde').length

    // Mês sem nenhum registro não vira e-mail: não há o que resumir.
    if (presencas + treinosFeitos + meus.length === 0) continue

    const partes = [
      `${presencas} ${presencas === 1 ? 'presença' : 'presenças'} no centro`,
      `${treinosFeitos} ${treinosFeitos === 1 ? 'treino concluído' : 'treinos concluídos'}`,
      `${meus.length} ${meus.length === 1 ? 'medição registrada' : 'medições registradas'}` +
        (meus.length > 0 ? `, ${Math.round((verdes / meus.length) * 100)}% na faixa verde` : ''),
    ]

    await notificar(supabase, aluno.id, {
      tipo: 'resumo_mensal',
      titulo: `${primeiroNome(aluno.nome)}, seu mês de ${nomeMes} na Atitude Vital`,
      corpo: `Em ${nomeMes} foram:\n${partes.map((p) => `· ${p}`).join('\n')}\n\nO relatório completo do mês está pronto no app, do jeito que o médico gosta de ver.`,
      url: `/relatorio?mes=${mes}`,
      canais: ['email'],
      chave: `resumo-mensal:${mes}`,
    })
    enviados += 1
  }
  return enviados
}
