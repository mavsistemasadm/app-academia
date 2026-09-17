/*
  Perguntas e respostas da anamnese. Client-safe: o formulário do aluno, o
  editor do professor, a ficha e o relatório usam as mesmas regras.

  A pergunta mora em `anamnese_perguntas` (migração 011). A resposta mora em
  `anamneses.respostas[pergunta.id]`; se ainda não estiver lá e a pergunta for
  uma das originais, sai da coluna antiga que `coluna_legada` aponta.
*/

import type { Anamnese } from '@/lib/types'

export type TipoPergunta =
  | 'texto_curto'
  | 'texto_longo'
  | 'escolha_unica'
  | 'multipla_escolha'
  | 'sim_nao'
  | 'numero'
  | 'escala'
  | 'data'

export type Resposta = string | string[] | boolean | number

export interface PerguntaAnamnese {
  id: string
  secao: string
  enunciado: string
  ajuda: string | null
  tipo: TipoPergunta
  opcoes: string[]
  obrigatoria: boolean
  no_relatorio: boolean
  ordem: number
  ativa: boolean
  coluna_legada: string | null
}

export const TIPOS_PERGUNTA: Record<TipoPergunta, { nome: string; descricao: string }> = {
  texto_curto: { nome: 'Texto curto', descricao: 'Uma linha' },
  texto_longo: { nome: 'Texto longo', descricao: 'Um parágrafo' },
  escolha_unica: { nome: 'Escolha única', descricao: 'Marca uma opção' },
  multipla_escolha: { nome: 'Múltipla escolha', descricao: 'Marca quantas quiser' },
  sim_nao: { nome: 'Sim ou não', descricao: 'Dois botões' },
  numero: { nome: 'Número', descricao: 'Peso, horas, cigarros…' },
  escala: { nome: 'Escala 0 a 10', descricao: 'Dor, estresse, cansaço' },
  data: { nome: 'Data', descricao: 'Cirurgia, último exame…' },
}

export const TEM_OPCOES: TipoPergunta[] = ['escolha_unica', 'multipla_escolha']

/** Colunas antigas de `anamneses` e o formato que cada uma aceita. */
const COLUNAS_LEGADAS: Record<string, 'texto' | 'lista' | 'booleano'> = {
  objetivo: 'texto',
  doencas: 'lista',
  lesoes: 'texto',
  cirurgias: 'texto',
  alergias: 'texto',
  medicamentos_uso: 'texto',
  historico_familiar: 'texto',
  pratica_atividade: 'texto',
  qualidade_sono: 'texto',
  consumo_alcool: 'texto',
  fumante: 'booleano',
  liberado_por_medico: 'booleano',
  restricoes_medicas: 'texto',
  observacoes: 'texto',
}

function padrao(
  n: number,
  coluna: string,
  secao: string,
  enunciado: string,
  tipo: TipoPergunta,
  extra: Partial<PerguntaAnamnese> = {}
): PerguntaAnamnese {
  return {
    id: `a0a0a0a0-0000-4000-8000-${String(n).padStart(12, '0')}`,
    secao,
    enunciado,
    ajuda: null,
    tipo,
    opcoes: [],
    obrigatoria: false,
    no_relatorio: false,
    ordem: n * 10,
    ativa: true,
    coluna_legada: coluna,
    ...extra,
  }
}

/**
 * As 14 perguntas de antes da migração 011, com os mesmos ids que ela
 * insere. Enquanto a tabela não existe, o app usa esta lista.
 */
export const PERGUNTAS_PADRAO: PerguntaAnamnese[] = [
  padrao(1, 'objetivo', 'Seu objetivo', 'O que você busca no centro?', 'texto_longo', {
    ajuda: 'Controlar a diabetes, ganhar disposição, voltar a subir escada sem cansar…',
    obrigatoria: true,
    no_relatorio: true,
  }),
  padrao(2, 'doencas', 'Histórico de saúde', 'Você tem alguma dessas condições?', 'multipla_escolha', {
    opcoes: [
      'Diabetes',
      'Hipertensão',
      'Colesterol alto',
      'Problema cardíaco',
      'Asma',
      'Problema de tireoide',
      'Artrose / artrite',
      'Osteoporose',
      'Hérnia de disco',
      'Depressão / ansiedade',
    ],
    no_relatorio: true,
  }),
  padrao(3, 'lesoes', 'Histórico de saúde', 'Lesões: atuais ou antigas', 'texto_curto', {
    ajuda: 'Dor no ombro direito, joelho que trava…',
    no_relatorio: true,
  }),
  padrao(4, 'cirurgias', 'Histórico de saúde', 'Cirurgias', 'texto_curto', {
    ajuda: 'Quais e quando',
  }),
  padrao(5, 'alergias', 'Histórico de saúde', 'Alergias', 'texto_curto', {
    ajuda: 'Medicamentos, alimentos, látex…',
    no_relatorio: true,
  }),
  padrao(6, 'medicamentos_uso', 'Histórico de saúde', 'Medicamentos em uso', 'texto_curto', {
    ajuda: 'Nome e dose de tudo que você toma',
    no_relatorio: true,
  }),
  padrao(7, 'historico_familiar', 'Histórico de saúde', 'Histórico familiar', 'texto_curto', {
    ajuda: 'Infarto, AVC, diabetes na família',
  }),
  padrao(8, 'pratica_atividade', 'Rotina', 'Você já praticava atividade física?', 'escolha_unica', {
    opcoes: [
      'Nunca pratiquei',
      'Parei há mais de um ano',
      'Parei há alguns meses',
      'Pratico às vezes',
      'Pratico toda semana',
    ],
  }),
  padrao(9, 'qualidade_sono', 'Rotina', 'Como você dorme?', 'escolha_unica', {
    opcoes: ['Durmo bem', 'Durmo razoável', 'Durmo mal', 'Tenho insônia'],
  }),
  padrao(10, 'consumo_alcool', 'Rotina', 'Bebida alcoólica', 'escolha_unica', {
    opcoes: ['Não bebo', 'Socialmente', 'Toda semana', 'Todo dia'],
  }),
  padrao(11, 'fumante', 'Rotina', 'Você fuma?', 'sim_nao'),
  padrao(12, 'liberado_por_medico', 'Liberação médica', 'Seu médico liberou você para atividade física?', 'sim_nao'),
  padrao(13, 'restricoes_medicas', 'Liberação médica', 'Restrições que o médico passou', 'texto_curto', {
    ajuda: 'Nada de impacto, não passar de 120 bpm…',
    no_relatorio: true,
  }),
  padrao(14, 'observacoes', 'Liberação médica', 'Mais alguma coisa que devemos saber?', 'texto_curto', {
    ajuda: 'Opcional',
  }),
]

/**
 * Coloca qualquer valor no formato do tipo da pergunta, ou devolve null se
 * não houver resposta. O professor pode trocar o tipo de uma pergunta que já
 * tem respostas: o que der para aproveitar, aproveita.
 */
export function normalizarResposta(tipo: TipoPergunta, valor: unknown): Resposta | null {
  if (valor === null || valor === undefined) return null

  switch (tipo) {
    case 'texto_curto':
    case 'texto_longo': {
      const texto = Array.isArray(valor)
        ? valor.join(', ')
        : typeof valor === 'boolean'
          ? valor ? 'Sim' : 'Não'
          : String(valor)
      return texto.trim() ? texto : null
    }
    case 'escolha_unica': {
      const texto = Array.isArray(valor) ? valor[0] : valor
      return typeof texto === 'string' && texto.trim() ? texto : null
    }
    case 'multipla_escolha': {
      const lista = (Array.isArray(valor) ? valor : [valor]).filter(
        (v): v is string => typeof v === 'string' && v.trim() !== ''
      )
      return lista.length > 0 ? lista : null
    }
    case 'sim_nao':
      if (typeof valor === 'boolean') return valor
      if (valor === 'Sim') return true
      if (valor === 'Não') return false
      return null
    case 'numero':
    case 'escala': {
      const numero = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'))
      if (typeof valor === 'string' && !valor.trim()) return null
      return Number.isFinite(numero) ? numero : null
    }
    case 'data':
      return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null
  }
}

/** A resposta que o aluno deu a uma pergunta, já no formato do tipo. */
export function respostaDe(
  pergunta: PerguntaAnamnese,
  anamnese: Anamnese | null
): Resposta | null {
  if (!anamnese) return null

  const respostas = anamnese.respostas ?? {}
  if (pergunta.id in respostas) {
    return normalizarResposta(pergunta.tipo, respostas[pergunta.id])
  }

  if (pergunta.coluna_legada) {
    const valor = (anamnese as unknown as Record<string, unknown>)[pergunta.coluna_legada]
    return normalizarResposta(pergunta.tipo, valor)
  }

  return null
}

/** Texto corrido para a ficha e o relatório. */
export function textoDaResposta(pergunta: PerguntaAnamnese, resposta: Resposta): string {
  if (typeof resposta === 'boolean') return resposta ? 'Sim' : 'Não'
  if (Array.isArray(resposta)) return resposta.join(', ')
  if (pergunta.tipo === 'escala') return `${resposta} de 10`
  if (pergunta.tipo === 'data' && typeof resposta === 'string') {
    const [ano, mes, dia] = resposta.split('-')
    return `${dia}/${mes}/${ano}`
  }
  if (typeof resposta === 'number') return String(resposta).replace('.', ',')
  return String(resposta)
}

/**
 * Perguntas respondidas, na ordem do formulário, com o texto pronto.
 * As arquivadas entram por último: a resposta continua valendo na ficha.
 */
export function respostasParaLeitura(
  perguntas: PerguntaAnamnese[],
  anamnese: Anamnese | null
): { pergunta: PerguntaAnamnese; texto: string }[] {
  if (!anamnese) return []

  return [...perguntas]
    .sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.ordem - b.ordem)
    .flatMap((pergunta) => {
      const resposta = respostaDe(pergunta, anamnese)
      return resposta === null ? [] : [{ pergunta, texto: textoDaResposta(pergunta, resposta) }]
    })
}

/** Seções na ordem da primeira pergunta de cada uma. */
export function agruparPorSecao(
  perguntas: PerguntaAnamnese[]
): { secao: string; perguntas: PerguntaAnamnese[] }[] {
  const grupos: { secao: string; perguntas: PerguntaAnamnese[] }[] = []

  for (const pergunta of [...perguntas].sort((a, b) => a.ordem - b.ordem)) {
    const grupo = grupos.find((g) => g.secao === pergunta.secao)
    if (grupo) grupo.perguntas.push(pergunta)
    else grupos.push({ secao: pergunta.secao, perguntas: [pergunta] })
  }

  return grupos
}

/**
 * O que gravar nas colunas antigas: continuam em dia para quem ainda lê
 * delas e para o app funcionar antes da migração 011.
 */
export function colunasLegadas(
  perguntas: PerguntaAnamnese[],
  respostas: Record<string, Resposta | null>
): Record<string, string | string[] | boolean | null> {
  const colunas: Record<string, string | string[] | boolean | null> = {}

  for (const pergunta of perguntas) {
    const formato = pergunta.coluna_legada && COLUNAS_LEGADAS[pergunta.coluna_legada]
    if (!pergunta.coluna_legada || !formato) continue

    const valor = respostas[pergunta.id] ?? null
    colunas[pergunta.coluna_legada] =
      valor === null
        ? null
        : formato === 'booleano'
          ? normalizarResposta('sim_nao', valor) as boolean | null
          : formato === 'lista'
            ? normalizarResposta('multipla_escolha', valor) as string[] | null
            : typeof valor === 'boolean' || Array.isArray(valor) || typeof valor === 'number'
              ? textoDaResposta(pergunta, valor)
              : valor
  }

  return colunas
}
