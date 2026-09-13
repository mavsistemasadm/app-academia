import type { AvatarCondicao, IndicadorTipo } from '@/lib/types'

interface AvatarInfo {
  label: string
  emoji: string
  descricao: string
}

export const AVATAR_CONFIG: Record<AvatarCondicao, AvatarInfo> = {
  diabetico: {
    label: 'Diabético',
    emoji: '🩸',
    descricao: 'Acompanhamento de glicemia',
  },
  hipertenso: {
    label: 'Hipertenso',
    emoji: '💓',
    descricao: 'Acompanhamento de pressão arterial',
  },
  '60+': {
    label: '60+',
    emoji: '🧓',
    descricao: 'Autonomia e saúde na melhor idade',
  },
  colesterol: {
    label: 'Colesterol',
    emoji: '🫀',
    descricao: 'Controle de colesterol',
  },
  menopausa: {
    label: 'Menopausa',
    emoji: '🌺',
    descricao: 'Acompanhamento do climatério',
  },
  performance: {
    label: 'Performance',
    emoji: '🏆',
    descricao: 'Treino de alto rendimento',
  },
  adolescente: {
    label: 'Adolescente',
    emoji: '🧒',
    descricao: 'Desenvolvimento saudável',
  },
  gestante: {
    label: 'Gestante',
    emoji: '🤰',
    descricao: 'Acompanhamento na gestação',
  },
  cardiopata: {
    label: 'Cardiopata',
    emoji: '🩺',
    descricao: 'Acompanhamento cardíaco',
  },
  obesidade: {
    label: 'Obesidade',
    emoji: '⚖️',
    descricao: 'Emagrecimento com saúde',
  },
}

/** Condições na ordem em que aparecem no cadastro. */
export const AVATAR_OPCOES = (
  Object.keys(AVATAR_CONFIG) as AvatarCondicao[]
).map((value) => ({ value, ...AVATAR_CONFIG[value] }))

/** Formato aceito por `<Select items>` — o trigger mostra esse label. */
export const AVATAR_SELECT_ITEMS = AVATAR_OPCOES.map(({ value, emoji, label }) => ({
  value,
  label: `${emoji}  ${label}`,
}))

/** Avatares que precisam de fonte maior e menos elementos por tela. */
export function precisaAcessibilidadeAmpliada(
  condicoes?: AvatarCondicao[] | null
) {
  return Boolean(
    condicoes?.some((c) => c === '60+' || c === 'cardiopata')
  )
}

/** "Diabético · Hipertenso" — para cards e cabeçalhos. */
export function rotularCondicoes(condicoes?: AvatarCondicao[] | null): string {
  if (!condicoes || condicoes.length === 0) return 'Sem condição informada'
  return condicoes.map((c) => AVATAR_CONFIG[c]?.label ?? c).join(' · ')
}

/**
 * O indicador que o app cobra antes do treino (módulo 13). A ordem importa:
 * quem é diabético *e* hipertenso responde primeiro a glicemia, que é a que
 * muda mais rápido e a que mais contraindica treino na hora.
 */
const INDICADOR_POR_CONDICAO: Partial<Record<AvatarCondicao, IndicadorTipo>> = {
  diabetico: 'glicemia',
  cardiopata: 'pressao',
  hipertenso: 'pressao',
  gestante: 'pressao',
  '60+': 'pressao',
  obesidade: 'peso',
  colesterol: 'pressao',
  menopausa: 'pressao',
  performance: 'fc',
}

export function indicadorPrioritario(
  condicoes?: AvatarCondicao[] | null
): IndicadorTipo | null {
  if (!condicoes?.length) return null

  const ordem: AvatarCondicao[] = [
    'diabetico',
    'cardiopata',
    'hipertenso',
    'gestante',
    '60+',
    'colesterol',
    'menopausa',
    'obesidade',
    'performance',
  ]

  for (const condicao of ordem) {
    if (condicoes.includes(condicao)) {
      return INDICADOR_POR_CONDICAO[condicao] ?? null
    }
  }

  return null
}
