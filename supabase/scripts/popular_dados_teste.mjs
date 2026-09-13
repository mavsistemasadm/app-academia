#!/usr/bin/env node
/**
 * Povoa o banco com uma academia de mentira, mas plausível: um professor,
 * oito alunos de condições diferentes e uns dois meses de história para
 * trás — o bastante para os gráficos, o streak, o calendário de humor e a
 * lista de sumidos terem o que mostrar.
 *
 *   node supabase/scripts/popular_dados_teste.mjs
 *
 * Roda com a service role, então ignora RLS. Só faz sentido em banco de
 * desenvolvimento. É idempotente: apaga o que semeou antes (todo usuário
 * do domínio de teste) e semeia de novo igual — o sorteio tem semente fixa.
 *
 * Exige a migração 004 aplicada; sem ela o script para antes de escrever.
 */

import { readFileSync } from 'node:fs'

// ── Ambiente ────────────────────────────────────────────────────

for (const linha of readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = linha.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_BASE || !CHAVE) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const DOMINIO_TESTE = 'teste.local'
const SENHA_TESTE = 'teste1234'
const TIMEZONE = 'America/Sao_Paulo'

// ── Cliente REST ────────────────────────────────────────────────

const cabecalhos = {
  apikey: CHAVE,
  Authorization: `Bearer ${CHAVE}`,
  'Content-Type': 'application/json',
}

async function rest(caminho, opcoes = {}) {
  const resposta = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhos, ...(opcoes.headers ?? {}) },
  })
  const texto = await resposta.text()
  if (!resposta.ok) {
    throw new Error(`${opcoes.method ?? 'GET'} ${caminho} → ${resposta.status} ${texto}`)
  }
  return texto ? JSON.parse(texto) : null
}

/**
 * O PostgREST recusa um lote cujos objetos não tenham exatamente as mesmas
 * chaves ("All object keys must match"), e vários lotes daqui são irregulares
 * — só pressão tem `valor_secundario`, só alguns eventos têm `avatar_condicao`.
 * Completar com null é seguro porque toda coluna que varia é nula por padrão;
 * nenhuma delas tem `default` que seria atropelado.
 */
function alinharChaves(linhas) {
  const todas = [...new Set(linhas.flatMap(Object.keys))]
  return linhas.map((linha) =>
    Object.fromEntries(todas.map((chave) => [chave, linha[chave] ?? null]))
  )
}

/** Insere em lotes: um INSERT de milhares de linhas estoura o corpo da requisição. */
async function inserir(tabela, linhas, { retorno = false } = {}) {
  if (linhas.length === 0) return []
  const alinhadas = alinharChaves(linhas)
  const saida = []
  for (let i = 0; i < alinhadas.length; i += 500) {
    const lote = alinhadas.slice(i, i + 500)
    const r = await rest(tabela, {
      method: 'POST',
      headers: { Prefer: retorno ? 'return=representation' : 'return=minimal' },
      body: JSON.stringify(lote),
    })
    if (retorno && r) saida.push(...r)
  }
  return saida
}

async function auth(caminho, opcoes = {}) {
  const resposta = await fetch(`${URL_BASE}/auth/v1/${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhos, ...(opcoes.headers ?? {}) },
  })
  const texto = await resposta.text()
  if (!resposta.ok) throw new Error(`${caminho} → ${resposta.status} ${texto}`)
  return texto ? JSON.parse(texto) : null
}

// ── Sorteio com semente fixa ────────────────────────────────────

let semente = 20260819
function aleatorio() {
  semente |= 0
  semente = (semente + 0x6d2b79f5) | 0
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const entre = (min, max) => min + aleatorio() * (max - min)
const inteiro = (min, max) => Math.floor(entre(min, max + 1))
const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)]
const chance = (p) => aleatorio() < p

// ── Datas, sempre no fuso da academia ───────────────────────────

const formatador = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function hojeISO() {
  const p = new Map(formatador.formatToParts(new Date()).map((x) => [x.type, x.value]))
  return `${p.get('year')}-${p.get('month')}-${p.get('day')}`
}

const HOJE = hojeISO()

function somarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` + `HH:MM` → timestamptz no horário de Brasília (UTC-3). */
function instante(iso, hora = '09:00') {
  return `${iso}T${hora}:00-03:00`
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
const diaDaSemana = (iso) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()]

/** Os últimos N dias, do mais antigo para o mais novo. */
const ultimosDias = (n) => Array.from({ length: n }, (_, i) => somarDias(HOJE, -(n - 1 - i)))

// ── Elenco ──────────────────────────────────────────────────────

const ALUNOS = [
  {
    chave: 'ana',
    nome: 'Ana Ferreira',
    condicoes: ['diabetico', 'obesidade'],
    nascimento: '1979-04-12',
    telefone: '(11) 98812-4477',
    altura: 1.62,
    pesoInicial: 92.4,
    dias: ['seg', 'qua', 'sex'],
    // Faltou a semana toda: é ela que aparece na lista de sumidos.
    frequencia: 0.75,
    diasSumida: 8,
    medicamentos: [
      { nome: 'Metformina', dose: '850 mg', horarios: ['08:00', '20:00'], condicao: 'Diabetes tipo 2' },
      { nome: 'Losartana', dose: '50 mg', horarios: ['08:00'], condicao: 'Pressão alta' },
    ],
    medico: ['Dr. Rubens Aoki', '(11) 3255-1180'],
    familiar: ['Carolina Ferreira (filha)', '(11) 99640-2231'],
    observacoes: 'Glicemia sobe muito no fim de semana. Evitar impacto no joelho direito.',
  },
  {
    chave: 'joao',
    nome: 'João Batista Nunes',
    condicoes: ['hipertenso', 'cardiopata', '60+'],
    nascimento: '1958-09-30',
    telefone: '(11) 99123-5510',
    altura: 1.71,
    pesoInicial: 84.1,
    dias: ['ter', 'qui'],
    frequencia: 0.9,
    // O caso vermelho recente: dispara alerta e barra o portão pré-treino.
    picoDePressao: true,
    medicamentos: [
      { nome: 'Enalapril', dose: '10 mg', horarios: ['07:00', '19:00'], condicao: 'Hipertensão' },
      { nome: 'AAS', dose: '100 mg', horarios: ['12:00'], condicao: 'Cardiopatia' },
      { nome: 'Sinvastatina', dose: '20 mg', horarios: ['21:00'], condicao: 'Colesterol' },
    ],
    medico: ['Dra. Heloísa Prado (cardio)', '(11) 3061-7744'],
    familiar: ['Terezinha Nunes (esposa)', '(11) 98877-1290'],
    observacoes: 'Ponte de safena em 2019. Não passar de 120 bpm. Traz o cartão do marca-passo.',
  },
  {
    chave: 'marlene',
    nome: 'Marlene Duarte',
    condicoes: ['60+', 'menopausa', 'colesterol'],
    nascimento: '1962-01-22',
    telefone: '(11) 97744-0388',
    altura: 1.58,
    pesoInicial: 68.9,
    dias: ['seg', 'qua', 'sex'],
    // A aluna exemplar: streak longo, tudo no verde.
    frequencia: 1,
    medicamentos: [
      { nome: 'Cálcio + Vitamina D', dose: '600 mg', horarios: ['09:00'], condicao: 'Osso' },
    ],
    medico: ['Dra. Sônia Bertoldi', '(11) 3477-9021'],
    familiar: ['Rafael Duarte (filho)', '(11) 99120-4455'],
    observacoes: 'Ondas de calor atrapalham o sono. Prefere treinar cedo.',
  },
  {
    chave: 'pedro',
    nome: 'Pedro Henrique Vasques',
    condicoes: ['performance'],
    nascimento: '1996-07-08',
    telefone: '(11) 99881-7702',
    altura: 1.83,
    pesoInicial: 79.5,
    dias: ['seg', 'ter', 'qui', 'sex'],
    frequencia: 0.95,
    medicamentos: [],
    medico: ['Dr. Igor Sammarco', '(11) 3812-0099'],
    familiar: ['Luísa Vasques (irmã)', '(11) 98110-6633'],
    observacoes: 'Meia maratona em outubro. Foco em força de perna sem perder volume de corrida.',
  },
  {
    chave: 'beatriz',
    nome: 'Beatriz Moraes',
    condicoes: ['gestante'],
    nascimento: '1994-11-17',
    telefone: '(11) 98220-3311',
    altura: 1.66,
    pesoInicial: 63.2,
    dias: ['ter', 'qui'],
    frequencia: 0.85,
    ganhandoPeso: true,
    medicamentos: [
      { nome: 'Ácido fólico', dose: '5 mg', horarios: ['08:00'], condicao: 'Gestação' },
      { nome: 'Sulfato ferroso', dose: '40 mg', horarios: ['14:00'], condicao: 'Anemia' },
    ],
    medico: ['Dra. Camila Rezende (obstetra)', '(11) 3399-4102'],
    familiar: ['Thiago Moraes (marido)', '(11) 99002-8871'],
    observacoes: '26 semanas. Liberada pela obstetra. Nada em decúbito dorsal, nada de Valsalva.',
  },
  {
    chave: 'sergio',
    nome: 'Sérgio Kimura',
    condicoes: ['colesterol', 'hipertenso'],
    nascimento: '1972-03-05',
    telefone: '(11) 99553-2018',
    altura: 1.75,
    pesoInicial: 88.7,
    dias: ['seg', 'qua', 'sex'],
    frequencia: 0.6,
    medicamentos: [
      { nome: 'Rosuvastatina', dose: '10 mg', horarios: ['22:00'], condicao: 'Colesterol' },
    ],
    medico: ['Dr. Rubens Aoki', '(11) 3255-1180'],
    familiar: ['Paula Kimura (esposa)', '(11) 98444-7712'],
    observacoes: 'Viaja muito a trabalho. Combinar treino de hotel nas semanas de viagem.',
  },
  {
    chave: 'lucas',
    nome: 'Lucas Andrade',
    condicoes: ['adolescente'],
    nascimento: '2009-05-19',
    telefone: '(11) 98330-1174',
    altura: 1.74,
    pesoInicial: 61.8,
    dias: ['ter', 'qui', 'sab'],
    frequencia: 0.8,
    ganhandoPeso: true,
    medicamentos: [],
    medico: ['Dr. Fábio Lins (pediatra)', '(11) 3777-2200'],
    familiar: ['Sandra Andrade (mãe)', '(11) 99771-3320'],
    observacoes: 'Autorização da mãe assinada. Carga moderada, foco em técnica.',
  },
  {
    chave: 'rosa',
    nome: 'Rosa Maria Teixeira',
    condicoes: ['diabetico', 'hipertenso', '60+'],
    nascimento: '1955-12-02',
    telefone: '(11) 97012-8845',
    altura: 1.54,
    pesoInicial: 74.3,
    dias: ['seg', 'qua'],
    frequencia: 0.7,
    // Combinação mais comum da casa — e a que mais gera amarelo.
    glicemiaInstavel: true,
    medicamentos: [
      { nome: 'Metformina', dose: '500 mg', horarios: ['08:00', '13:00', '20:00'], condicao: 'Diabetes' },
      { nome: 'Hidroclorotiazida', dose: '25 mg', horarios: ['08:00'], condicao: 'Pressão alta' },
    ],
    medico: ['Dra. Heloísa Prado', '(11) 3061-7744'],
    familiar: ['Juliana Teixeira (neta)', '(11) 99887-4400'],
    observacoes: 'Mora sozinha. A neta acompanha pelo app. Catarata no olho esquerdo — cuidado com degrau.',
  },
]

const EXERCICIOS_POR_CONDICAO = {
  forca_leve: [
    { nome: 'Cadeira extensora', series: 3, repeticoes: '12', carga: '15 kg', descanso: '60s' },
    { nome: 'Leg press horizontal', series: 3, repeticoes: '12', carga: '40 kg', descanso: '90s' },
    { nome: 'Remada baixa', series: 3, repeticoes: '12', carga: '20 kg', descanso: '60s' },
    { nome: 'Supino máquina', series: 3, repeticoes: '12', carga: '15 kg', descanso: '60s' },
    { nome: 'Elevação lateral', series: 3, repeticoes: '15', carga: '3 kg', descanso: '45s' },
    { nome: 'Caminhada na esteira', series: 1, repeticoes: '15 min', carga: '5 km/h', descanso: '—' },
  ],
  forca_media: [
    { nome: 'Agachamento livre', series: 4, repeticoes: '10', carga: '40 kg', descanso: '90s' },
    { nome: 'Levantamento terra', series: 4, repeticoes: '8', carga: '60 kg', descanso: '120s' },
    { nome: 'Supino reto', series: 4, repeticoes: '10', carga: '50 kg', descanso: '90s' },
    { nome: 'Barra fixa assistida', series: 3, repeticoes: '8', carga: 'assist. 20 kg', descanso: '90s' },
    { nome: 'Desenvolvimento halteres', series: 3, repeticoes: '10', carga: '12 kg', descanso: '60s' },
    { nome: 'Prancha', series: 3, repeticoes: '40s', carga: '—', descanso: '45s' },
  ],
  funcional: [
    { nome: 'Sentar e levantar da cadeira', series: 3, repeticoes: '10', carga: 'peso do corpo', descanso: '60s' },
    { nome: 'Elevação de panturrilha apoiada', series: 3, repeticoes: '15', carga: 'peso do corpo', descanso: '45s' },
    { nome: 'Remada com elástico', series: 3, repeticoes: '12', carga: 'elástico verde', descanso: '60s' },
    { nome: 'Marcha estacionária', series: 3, repeticoes: '1 min', carga: '—', descanso: '60s' },
    { nome: 'Equilíbrio unipodal', series: 3, repeticoes: '20s cada pé', carga: '—', descanso: '30s' },
    { nome: 'Bicicleta horizontal', series: 1, repeticoes: '12 min', carga: 'carga 3', descanso: '—' },
  ],
}

const VIDEOS = [
  'https://www.youtube.com/watch?v=aclHkVaku9U',
  'https://www.youtube.com/watch?v=IODxDxX7oi4',
  'https://vimeo.com/76979871',
]

// ── Regras de indicador por condição ────────────────────────────

/** Faixas de rotina de cada aluno — dentro do verde salvo quando o roteiro pede. */
function indicadoresDoDia(aluno, dia, indice, total) {
  const saida = []
  const recente = indice >= total - 3
  const cond = aluno.condicoes

  if (cond.includes('diabetico')) {
    let glicemia = entre(88, 118)
    if (aluno.glicemiaInstavel && chance(0.35)) glicemia = entre(127, 172) // amarelo
    if (aluno.glicemiaInstavel && recente && chance(0.4)) glicemia = entre(205, 232) // vermelho
    saida.push({
      tipo: 'glicemia',
      valor_principal: Math.round(glicemia),
      unidade: 'mg/dL',
      momento: 'jejum',
    })
  }

  if (cond.includes('hipertenso') || cond.includes('cardiopata')) {
    let sistolica = entre(112, 128)
    let diastolica = entre(70, 83)
    if (chance(0.22)) {
      sistolica = entre(132, 152) // amarelo
      diastolica = entre(86, 96)
    }
    if (aluno.picoDePressao && indice === total - 2) {
      sistolica = 168 // vermelho: é este que abre o alerta no painel
      diastolica = 104
    }
    saida.push({
      tipo: 'pressao',
      valor_principal: Math.round(sistolica),
      valor_secundario: Math.round(diastolica),
      unidade: 'mmHg',
      momento: 'repouso',
      observacao:
        aluno.picoDePressao && indice === total - 2
          ? 'Medi em casa, estava com dor de cabeça desde cedo.'
          : null,
    })
  }

  if (cond.includes('cardiopata') || cond.includes('performance') || cond.includes('60+')) {
    let fc = entre(58, 82)
    if (chance(0.15)) fc = entre(92, 99) // amarelo
    saida.push({
      tipo: 'fc',
      valor_principal: Math.round(fc),
      unidade: 'bpm',
      momento: chance(0.5) ? 'repouso' : 'pre_treino',
    })
  }

  if (cond.includes('cardiopata') || cond.includes('60+')) {
    let sat = entre(95, 99)
    if (chance(0.1)) sat = entre(91, 94) // amarelo
    saida.push({
      tipo: 'saturacao',
      valor_principal: Math.round(sat),
      unidade: '%',
      momento: 'repouso',
    })
  }

  return saida.map((i) => ({
    ...i,
    momento: i.momento ?? 'repouso',
    created_at: instante(dia, `0${inteiro(6, 9)}:${String(inteiro(0, 59)).padStart(2, '0')}`),
  }))
}

// ── Peso: uma medida por semana, com tendência ──────────────────

function pesoNaSemana(aluno, semana) {
  const passo = aluno.ganhandoPeso ? entre(0.15, 0.4) : -entre(0.1, 0.45)
  return Number((aluno.pesoInicial + passo * semana + entre(-0.25, 0.25)).toFixed(1))
}

// ── Limpeza ─────────────────────────────────────────────────────

/*
  Apagar o aluno não é um DELETE só. `profiles.id` referencia `auth.users`
  sem cascata, e quatro tabelas apontam para `profiles` também sem cascata —
  então some primeiro com os filhos órfãos, depois com o perfil (que cascateia
  o resto), e só então com a conta de autenticação.
*/
const SEM_CASCATA = [
  'exercicio_execucoes',
  'alertas_professor',
  'medicamento_confirmacoes',
  'treino_execucoes',
]

async function apagarAluno(id) {
  for (const tabela of SEM_CASCATA) {
    await rest(`${tabela}?aluno_id=eq.${id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })
  }
  await rest(`mensagens?or=(de.eq.${id},para.eq.${id})`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
  await rest(`profiles?id=eq.${id}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
  await auth(`admin/users/${id}`, { method: 'DELETE' })
}

async function limpar() {
  const { users } = await auth('admin/users?per_page=200')
  const semeados = users.filter((u) => u.email?.endsWith(DOMINIO_TESTE))

  for (const u of semeados) await apagarAluno(u.id)

  console.log(`  ${semeados.length} usuário(s) de teste anterior(es) removido(s)`)

  // Eventos, comunicados e alertas não penduram em aluno apagado.
  await rest('eventos?titulo=like.*[teste]*', { method: 'DELETE' })
  await rest('notificacoes?titulo=like.*[teste]*', { method: 'DELETE' })
}

// ── Execução ────────────────────────────────────────────────────

async function main() {
  console.log('\n▸ Conferindo a migração 004…')

  const resposta = await fetch(`${URL_BASE}/rest/v1/checkins?select=id&limit=1`, { headers: cabecalhos })
  if (resposta.status === 404) {
    console.error(
      '\n  A tabela `checkins` não existe — a migração 004 ainda não foi aplicada.\n' +
        '  Rode supabase/migrations/004_tabelas_que_faltavam.sql no SQL Editor antes\n' +
        '  deste script; sem ela metade dos módulos não tem onde gravar.\n'
    )
    process.exit(1)
  }
  console.log('  ok')

  console.log('\n▸ Localizando o professor…')
  const professores = await rest('profiles?select=id,nome,email&role=eq.professor&order=created_at.asc')
  if (professores.length === 0) {
    console.error('  Nenhum profile com role=professor. Crie a conta do professor antes.')
    process.exit(1)
  }
  const dono = professores[0]
  console.log(`  ${dono.nome} <${dono.email}>`)

  // Professor não tem condição clínica — sobra do cadastro antigo.
  await rest(`profiles?id=eq.${dono.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ avatar_condicao: null }),
  })

  console.log('\n▸ Limpando semeaduras anteriores…')
  await limpar()

  /*
    Uma professora de teste com senha conhecida. O painel é de acesso comum —
    a policy do 004 deixa qualquer professor ver qualquer aluno — então ela
    enxerga a casa inteira sem precisar ser dona de nenhum treino.
  */
  console.log('\n▸ Criando a professora de teste…')
  const professora = await auth('admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: `professora@${DOMINIO_TESTE}`,
      password: SENHA_TESTE,
      email_confirm: true,
      user_metadata: {
        nome: 'Rita Salgado',
        telefone: '(11) 98100-2244',
        role: 'professor',
      },
    }),
  })
  console.log(`  Rita Salgado               professora@${DOMINIO_TESTE}`)

  /*
    Daqui para baixo, a dona de tudo é a Rita. Não é detalhe: os alertas têm
    dono — a policy é `auth.uid() = professor_id` e `professor_responsavel()`
    acha o professor pelo treino ativo do aluno. Pendurando os treinos nela,
    o gatilho manda os alertas para ela também, e a conta de teste mostra o
    painel inteiro funcionando sem depender da conta do dono do projeto.
  */
  const professor = { id: professora.id, nome: 'Rita Salgado', email: professora.email }

  console.log('\n▸ Criando alunos…')
  const criados = []

  for (const aluno of ALUNOS) {
    const email = `${aluno.chave}@${DOMINIO_TESTE}`
    const usuario = await auth('admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: SENHA_TESTE,
        email_confirm: true,
        user_metadata: {
          nome: aluno.nome,
          telefone: aluno.telefone,
          role: 'aluno',
          avatar_condicao: aluno.condicoes,
        },
      }),
    })

    // O trigger cria o perfil básico; o resto do cadastro vem daqui.
    await rest(`profiles?id=eq.${usuario.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        data_nascimento: aluno.nascimento,
        observacoes_clinicas: aluno.observacoes,
        medico_nome: aluno.medico[0],
        medico_telefone: aluno.medico[1],
        familiar_nome: aluno.familiar[0],
        familiar_telefone: aluno.familiar[1],
        meta_agua_ml: aluno.condicoes.includes('gestante') ? 2500 : 2000,
        ativo: true,
      }),
    })

    criados.push({ ...aluno, id: usuario.id, email })
    console.log(`  ${aluno.nome.padEnd(26)} ${email}`)
  }

  console.log('\n▸ Agenda e comunicados da academia…')

  await inserir('eventos', [
    {
      professor_id: professor.id,
      titulo: '[teste] Aferição de pressão com a enfermeira',
      descricao: 'Quinta das 8h às 11h, na recepção. Não precisa marcar, é por ordem de chegada.',
      data_inicio: instante(somarDias(HOJE, 2), '08:00'),
      data_fim: instante(somarDias(HOJE, 2), '11:00'),
      para_todos: false,
      avatar_condicao: ['hipertenso', 'cardiopata', '60+'],
    },
    {
      professor_id: professor.id,
      titulo: '[teste] Palestra: açúcar escondido no supermercado',
      descricao: 'Com a nutricionista Dani. Traga a embalagem de um produto que você come sempre.',
      data_inicio: instante(somarDias(HOJE, 6), '19:00'),
      data_fim: instante(somarDias(HOJE, 6), '20:30'),
      para_todos: false,
      avatar_condicao: ['diabetico', 'obesidade', 'colesterol'],
    },
    {
      professor_id: professor.id,
      titulo: '[teste] Caminhada de domingo no parque',
      descricao: 'Encontro às 7h30 na portaria. Leve garrafa de água e boné.',
      data_inicio: instante(somarDias(HOJE, 4), '07:30'),
      data_fim: instante(somarDias(HOJE, 4), '09:00'),
      para_todos: true,
    },
    {
      professor_id: professor.id,
      titulo: '[teste] Avaliação física trimestral',
      descricao: 'Agendamento na recepção. Vir em jejum de 3 horas.',
      data_inicio: instante(somarDias(HOJE, -9), '08:00'),
      data_fim: instante(somarDias(HOJE, -9), '18:00'),
      para_todos: true,
    },
  ])

  await inserir('notificacoes', [
    {
      professor_id: professor.id,
      titulo: '[teste] Feriado: sábado abrimos só até meio-dia',
      corpo: 'Quem treina de tarde, remarque para a manhã. A sala de musculação fecha 12h em ponto.',
      para_todos: true,
    },
    {
      professor_id: professor.id,
      titulo: '[teste] Bebedouro novo no segundo andar',
      corpo: 'Com água gelada e filtro trocado. Aproveite para bater a meta do dia.',
      para_todos: true,
    },
    {
      professor_id: professor.id,
      titulo: '[teste] Grupo de caminhada 60+ mudou de horário',
      corpo: 'Agora é terça e quinta, 7h30, com a professora Rita.',
      para_todos: false,
      avatar_condicao: ['60+'],
    },
  ])

  const eventos = await rest('eventos?select=id,titulo,para_todos,avatar_condicao&titulo=like.*[teste]*')

  // ── Por aluno ─────────────────────────────────────────────────

  const dias60 = ultimosDias(60)
  const dias30 = ultimosDias(30)

  for (const aluno of criados) {
    process.stdout.write(`\n▸ ${aluno.nome}\n`)

    // ── Treino ────────────────────────────────────────────────
    const perfilExercicio = aluno.condicoes.includes('performance')
      ? 'forca_media'
      : aluno.condicoes.includes('60+') || aluno.condicoes.includes('cardiopata')
        ? 'funcional'
        : 'forca_leve'

    const [treino] = await inserir(
      'treinos',
      [
        {
          professor_id: professor.id,
          aluno_id: aluno.id,
          nome:
            perfilExercicio === 'funcional'
              ? 'Treino A — funcional e equilíbrio'
              : perfilExercicio === 'forca_media'
                ? 'Treino A — força de perna'
                : 'Treino A — corpo inteiro',
          descricao: 'Aquecer 5 minutos na esteira antes de começar. Beber água entre as séries.',
          dia_semana: aluno.dias,
          ativo: true,
        },
      ],
      { retorno: true }
    )

    const exercicios = await inserir(
      'exercicios',
      EXERCICIOS_POR_CONDICAO[perfilExercicio].map((e, i) => ({
        treino_id: treino.id,
        ...e,
        ordem: i,
        video_url: i < 2 ? VIDEOS[i % VIDEOS.length] : null,
        observacoes: i === 0 ? 'Subir devagar, descer em 3 segundos.' : null,
      })),
      { retorno: true }
    )
    console.log(`  treino com ${exercicios.length} exercícios`)

    // ── Presença, execuções e séries ──────────────────────────
    const execucoes = []
    const checkins = []

    for (const dia of dias60) {
      if (!aluno.dias.includes(diaDaSemana(dia))) continue
      // Quem sumiu, sumiu: nada nos últimos N dias.
      if (aluno.diasSumida && dia > somarDias(HOJE, -aluno.diasSumida)) continue
      if (!chance(aluno.frequencia)) continue

      const entrada = `0${inteiro(6, 9)}:${String(inteiro(0, 59)).padStart(2, '0')}`
      const saida = `${inteiro(10, 11)}:${String(inteiro(0, 59)).padStart(2, '0')}`

      checkins.push({
        aluno_id: aluno.id,
        data: dia,
        entrada: instante(dia, entrada),
        saida: instante(dia, saida),
        origem: 'app',
      })

      execucoes.push({
        treino_id: treino.id,
        aluno_id: aluno.id,
        data: dia,
        concluido: true,
        esforco_percebido: inteiro(5, 8),
        observacao: chance(0.15) ? escolher([
          'Joelho reclamou na última série.',
          'Dia bom, subi a carga do leg.',
          'Cansada, mas terminei.',
          'Faltou fôlego na esteira.',
        ]) : null,
        created_at: instante(dia, entrada),
      })
    }

    await inserir('checkins', checkins)
    const execucoesCriadas = await inserir('treino_execucoes', execucoes, { retorno: true })
    console.log(`  ${checkins.length} check-ins · ${execucoesCriadas.length} treinos concluídos`)

    // Série a série só nas últimas execuções — é o que a tela mostra.
    const series = []
    for (const execucao of execucoesCriadas.slice(-6)) {
      for (const exercicio of exercicios) {
        for (let s = 1; s <= (exercicio.series ?? 1); s++) {
          series.push({
            execucao_id: execucao.id,
            exercicio_id: exercicio.id,
            aluno_id: aluno.id,
            serie: s,
            carga: exercicio.carga,
            repeticoes: exercicio.repeticoes,
            created_at: execucao.created_at,
          })
        }
      }
    }
    await inserir('exercicio_execucoes', series)
    console.log(`  ${series.length} séries marcadas`)

    // ── Indicadores ───────────────────────────────────────────
    const indicadores = []

    dias60.forEach((dia, i) => {
      // Ninguém mede todo santo dia.
      if (!chance(0.55)) return
      for (const ind of indicadoresDoDia(aluno, dia, i, dias60.length)) {
        indicadores.push({ aluno_id: aluno.id, ...ind })
      }
    })

    // Peso: uma vez por semana, para o gráfico ter linha limpa.
    for (let semana = 0; semana < 9; semana++) {
      const dia = somarDias(HOJE, -(8 - semana) * 7)
      indicadores.push({
        aluno_id: aluno.id,
        tipo: 'peso',
        valor_principal: pesoNaSemana(aluno, semana),
        unidade: 'kg',
        momento: 'jejum',
        created_at: instante(dia, '07:15'),
      })
    }

    await inserir('indicadores', indicadores)
    console.log(`  ${indicadores.length} indicadores`)

    // ── Remédios ──────────────────────────────────────────────
    const medicamentos = await inserir(
      'medicamentos',
      aluno.medicamentos.map((m) => ({
        aluno_id: aluno.id,
        nome: m.nome,
        dose: m.dose,
        horarios: m.horarios,
        dias_semana: [],
        condicao: m.condicao,
        ativo: true,
      })),
      { retorno: true }
    )

    const confirmacoes = []
    for (const medicamento of medicamentos) {
      for (const dia of dias30) {
        for (const horario of medicamento.horarios) {
          // Hoje ainda está acontecendo: deixa as doses em aberto.
          if (dia === HOJE) continue
          if (!chance(0.88)) continue
          confirmacoes.push({
            medicamento_id: medicamento.id,
            aluno_id: aluno.id,
            data: dia,
            horario,
            status: chance(0.96) ? 'tomou' : 'nao_tomou',
            data_hora: instante(dia, horario),
            motivo: null,
          })
        }
      }
    }
    await inserir('medicamento_confirmacoes', confirmacoes)
    if (medicamentos.length) {
      console.log(`  ${medicamentos.length} medicamentos · ${confirmacoes.length} confirmações`)
    }

    // ── Humor ─────────────────────────────────────────────────
    const humores = []
    for (const dia of dias30) {
      if (!chance(0.8)) continue
      let humor = escolher(['otimo', 'disposto', 'disposto', 'cansado', 'dormiu_mal'])
      // Enfermo/ansioso abre alerta para o professor — deixa raro e recente.
      if (dia > somarDias(HOJE, -5) && chance(0.2)) humor = escolher(['ansioso', 'enfermo'])
      humores.push({
        aluno_id: aluno.id,
        data: dia,
        humor,
        qualidade_sono: inteiro(2, 5),
        observacao: humor === 'dormiu_mal' ? 'Acordei várias vezes de madrugada.' : null,
        created_at: instante(dia, '07:00'),
      })
    }
    await inserir('humor_diario', humores)
    console.log(`  ${humores.length} registros de humor`)

    // ── Hidratação ────────────────────────────────────────────
    const goles = []
    for (const dia of dias30) {
      const meta = aluno.condicoes.includes('gestante') ? 2500 : 2000
      const alvo = chance(0.6) ? meta + inteiro(0, 500) : meta - inteiro(200, 900)
      let acumulado = 0
      let hora = 8
      while (acumulado < alvo && hora < 22) {
        const quantidade = escolher([200, 200, 300, 500])
        goles.push({
          aluno_id: aluno.id,
          data: dia,
          quantidade_ml: quantidade,
          created_at: instante(dia, `${String(hora).padStart(2, '0')}:${String(inteiro(0, 59)).padStart(2, '0')}`),
        })
        acumulado += quantidade
        hora += inteiro(1, 2)
      }
    }
    await inserir('hidratacao_registros', goles)
    console.log(`  ${goles.length} registros de água`)

    // ── Anamnese ──────────────────────────────────────────────
    await inserir('anamneses', [
      {
        aluno_id: aluno.id,
        doencas: aluno.condicoes,
        cirurgias: aluno.chave === 'joao' ? 'Ponte de safena, 2019.' : 'Nenhuma.',
        lesoes: aluno.chave === 'ana' ? 'Condromalácia no joelho direito.' : 'Nada relevante.',
        alergias: chance(0.3) ? 'Dipirona.' : 'Nenhuma conhecida.',
        medicamentos_uso: aluno.medicamentos.map((m) => `${m.nome} ${m.dose}`).join(', ') || 'Nenhum.',
        historico_familiar: escolher([
          'Pai infartou aos 62.',
          'Mãe diabética.',
          'Hipertensão dos dois lados.',
          'Nada relevante.',
        ]),
        pratica_atividade: escolher(['Sedentário até agora', 'Caminhava aos domingos', 'Treinava há 2 anos']),
        fumante: chance(0.15),
        consumo_alcool: escolher(['Não bebo', 'Socialmente', 'Toda semana']),
        qualidade_sono: escolher(['Boa', 'Regular', 'Ruim']),
        objetivo: escolher([
          'Controlar a doença e ter mais disposição.',
          'Voltar a subir escada sem cansar.',
          'Ganhar força para brincar com os netos.',
          'Melhorar o condicionamento.',
        ]),
        restricoes_medicas: aluno.observacoes,
        liberado_por_medico: true,
        observacoes: null,
        atualizado_em: instante(somarDias(HOJE, -55), '10:00'),
        created_at: instante(somarDias(HOJE, -55), '10:00'),
      },
    ])

    // ── Avaliações físicas ────────────────────────────────────
    const avaliacoes = [0, 1, 2].map((n) => {
      const dia = somarDias(HOJE, -(2 - n) * 28 - 2)
      const peso = pesoNaSemana(aluno, n * 4)
      return {
        aluno_id: aluno.id,
        professor_id: professor.id,
        data: dia,
        peso,
        altura: aluno.altura,
        imc: Number((peso / (aluno.altura * aluno.altura)).toFixed(1)),
        percentual_gordura: Number(entre(18, 36).toFixed(1)),
        massa_muscular: Number(entre(22, 38).toFixed(1)),
        circunferencia_cintura: Number(entre(72, 108).toFixed(1)),
        circunferencia_quadril: Number(entre(92, 118).toFixed(1)),
        teste_forca: `Preensão manual ${inteiro(18, 42)} kgf`,
        observacoes: n === 2 ? 'Boa evolução na força de membro inferior.' : null,
        created_at: instante(dia, '09:00'),
      }
    })
    await inserir('avaliacoes_fisicas', avaliacoes)
    console.log(`  3 avaliações físicas · anamnese`)

    // ── Confirmação de evento ─────────────────────────────────
    const paraEle = eventos.filter(
      (e) => e.para_todos || (e.avatar_condicao ?? []).some((c) => aluno.condicoes.includes(c))
    )
    await inserir(
      'evento_confirmacoes',
      paraEle.filter(() => chance(0.6)).map((e) => ({
        evento_id: e.id,
        aluno_id: aluno.id,
        confirmado: true,
      }))
    )

    // ── Conversa com o professor ──────────────────────────────
    const conversa = [
      { de: aluno.id, texto: escolher([
        'Professor, posso trocar o agachamento? Meu joelho travou ontem.',
        'Bom dia! Cheguei atrasada hoje, dá para treinar às 10h?',
        'Minha glicemia acordou 190 hoje. Treino mesmo assim?',
        'Terminei o treino de ontem, achei mais fácil que semana passada.',
      ]), dias: 3 },
      { de: professor.id, texto: escolher([
        'Bom dia! Pode vir sim, te espero aqui.',
        'Vamos trocar por leg press hoje. Nada de dor, combinado?',
        'Melhor não. Mede de novo em uma hora e me manda.',
        'Ótimo sinal! Vou subir a carga na próxima.',
      ]), dias: 3 },
      { de: aluno.id, texto: 'Combinado, obrigado!', dias: 2 },
    ]

    await inserir(
      'mensagens',
      conversa.map((m) => ({
        de: m.de,
        para: m.de === aluno.id ? professor.id : aluno.id,
        texto: m.texto,
        lida: m.dias > 2,
        created_at: instante(somarDias(HOJE, -m.dias), `1${inteiro(0, 7)}:${String(inteiro(0, 59)).padStart(2, '0')}`),
      }))
    )
  }

  // ── Resumo ──────────────────────────────────────────────────
  console.log('\n▸ Conferindo o que ficou no banco…\n')

  for (const tabela of [
    'profiles', 'treinos', 'exercicios', 'treino_execucoes', 'exercicio_execucoes',
    'checkins', 'indicadores', 'medicamentos', 'medicamento_confirmacoes',
    'humor_diario', 'hidratacao_registros', 'anamneses', 'avaliacoes_fisicas',
    'eventos', 'evento_confirmacoes', 'notificacoes', 'mensagens', 'alertas_professor',
  ]) {
    const r = await fetch(`${URL_BASE}/rest/v1/${tabela}?select=*`, {
      headers: { ...cabecalhos, Prefer: 'count=exact', Range: '0-0' },
    })
    const total = (r.headers.get('content-range') ?? '*/?').split('/')[1]
    console.log(`  ${tabela.padEnd(26)} ${String(total).padStart(6)}`)
  }

  const alertas = await rest('alertas_professor?select=tipo,mensagem&resolvido=eq.false&order=created_at.desc&limit=6')
  if (alertas.length) {
    console.log('\n  Alertas abertos no painel do professor:')
    for (const a of alertas) console.log(`    · [${a.tipo}] ${a.mensagem}`)
  }

  console.log(`\n▸ Pronto. Entre como qualquer aluno com a senha "${SENHA_TESTE}":`)
  for (const a of criados) console.log(`    ${a.email.padEnd(34)} ${a.condicoes.join(', ')}`)
  console.log(`\n  E no painel do professor:`)
  console.log(`    professora@${DOMINIO_TESTE}`.padEnd(38) + `senha "${SENHA_TESTE}"`)
  console.log(`    ${dono.email}`.padEnd(38) + `senha sua — mas os alertas são da Rita\n`)
}

main().catch((erro) => {
  console.error('\n✖', erro.message, '\n')
  process.exit(1)
})
