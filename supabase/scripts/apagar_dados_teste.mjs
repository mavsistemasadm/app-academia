#!/usr/bin/env node
/**
 * Tira do banco tudo o que popular_dados_teste.mjs semeou: as contas do
 * domínio de teste (a professora Rita e os oito alunos) com todo o histórico
 * delas, os eventos e comunicados marcados [teste] e as aulas e desafios que
 * a conta de teste da professora criou. Conta real e o que ela criou ficam.
 *
 *   node supabase/scripts/apagar_dados_teste.mjs            só lista
 *   node supabase/scripts/apagar_dados_teste.mjs --apagar   apaga de verdade
 *
 * Roda com a service role (ignora RLS). Não tem volta: rode sem --apagar
 * primeiro e confira a lista.
 */

import { readFileSync } from 'node:fs'

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
const APAGAR = process.argv.includes('--apagar')

const cabecalhos = {
  apikey: CHAVE,
  Authorization: `Bearer ${CHAVE}`,
  'Content-Type': 'application/json',
}

/** Tabela que ainda não existe (migração não aplicada) conta como vazia. */
async function rest(caminho, opcoes = {}) {
  const resposta = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhos, ...(opcoes.headers ?? {}) },
  })
  const texto = await resposta.text()
  if (resposta.status === 404 || /PGRST205|42P01/.test(texto)) return null
  if (!resposta.ok) {
    throw new Error(`${opcoes.method ?? 'GET'} ${caminho} → ${resposta.status} ${texto}`)
  }
  return texto ? JSON.parse(texto) : null
}

async function auth(caminho, opcoes = {}) {
  const resposta = await fetch(`${URL_BASE}/auth/v1/${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhos, ...(opcoes.headers ?? {}) },
  })
  const texto = await resposta.text()
  if (!resposta.ok) throw new Error(`auth ${caminho} → ${resposta.status} ${texto}`)
  return texto ? JSON.parse(texto) : null
}

async function contar(caminho) {
  const linhas = await rest(`${caminho}${caminho.includes('?') ? '&' : '?'}select=id`)
  return linhas?.length ?? 0
}

async function apagar(caminho) {
  await rest(caminho, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

// ── O que é de teste ────────────────────────────────────────────

const usuarios = []
for (let pagina = 1; pagina <= 50; pagina++) {
  const { users } = await auth(`admin/users?page=${pagina}&per_page=1000`)
  usuarios.push(...users)
  if (users.length < 1000) break
}

const contas = usuarios.filter((u) => u.email?.toLowerCase().endsWith(`@${DOMINIO_TESTE}`))
const ids = contas.map((u) => u.id)
const lista = `(${ids.join(',')})`

console.log(`\n▸ Contas de teste: ${contas.length}`)
for (const u of contas) console.log(`  ${u.email}`)

// Filhos que apontam para profiles sem cascata (sem a 006) ou por outra coluna.
const PASSOS = ids.length
  ? [
      ['aulas criadas pela conta de teste', `aulas_horarios?professor_id=in.${lista}`],
      ['desafios criados pela conta de teste', `desafios?criado_por=in.${lista}`],
      ['comunicados da conta de teste', `notificacoes?professor_id=in.${lista}`],
      ['alertas', `alertas_professor?or=(aluno_id.in.${lista},professor_id.in.${lista})`],
      ['avaliações físicas', `avaliacoes_fisicas?or=(aluno_id.in.${lista},professor_id.in.${lista})`],
      ['séries marcadas', `exercicio_execucoes?aluno_id=in.${lista}`],
      ['doses confirmadas', `medicamento_confirmacoes?aluno_id=in.${lista}`],
      ['treinos executados', `treino_execucoes?aluno_id=in.${lista}`],
      ['mensagens', `mensagens?or=(de.in.${lista},para.in.${lista})`],
    ]
  : []

PASSOS.push(
  ['eventos marcados [teste]', 'eventos?titulo=like.*%5Bteste%5D*'],
  ['comunicados marcados [teste]', 'notificacoes?titulo=like.*%5Bteste%5D*']
)

console.log('\n▸ Junto com elas:')
for (const [nome, caminho] of PASSOS) {
  console.log(`  ${String(await contar(caminho)).padStart(5)}  ${nome}`)
}
if (ids.length) {
  console.log('  e o resto do histórico das contas (indicadores, humor, check-ins,')
  console.log('  hidratação, medicamentos, treinos...), que sai em cascata com o perfil.')
}

if (!APAGAR) {
  console.log('\nNada foi apagado. Para apagar, rode de novo com --apagar.\n')
  process.exit(0)
}

// ── Apagar ──────────────────────────────────────────────────────

console.log('\n▸ Apagando...')
for (const [nome, caminho] of PASSOS) {
  await apagar(caminho)
  console.log(`  ok  ${nome}`)
}

for (const u of contas) {
  await apagar(`profiles?id=eq.${u.id}`)
  await auth(`admin/users/${u.id}`, { method: 'DELETE' })
  console.log(`  ok  ${u.email}`)
}

console.log('\nPronto. Confira o painel: a lista de alunos deve ficar só com os reais.\n')
