import type { SupabaseClient } from '@supabase/supabase-js'

import { PERGUNTAS_PADRAO, type PerguntaAnamnese } from '@/lib/utils/anamnese'

export interface PerguntasAnamnese {
  perguntas: PerguntaAnamnese[]
  /** A tabela respondeu. Se não, a migração 011 falta e vale a lista do código. */
  editavel: boolean
}

/**
 * Perguntas da anamnese na ordem do formulário. Sem `incluirArquivadas`, só
 * as que o aluno ainda responde.
 */
export async function getPerguntasAnamnese(
  supabase: SupabaseClient,
  { incluirArquivadas = false }: { incluirArquivadas?: boolean } = {}
): Promise<PerguntasAnamnese> {
  let consulta = supabase
    .from('anamnese_perguntas')
    .select('*')
    .order('ordem', { ascending: true })

  if (!incluirArquivadas) consulta = consulta.eq('ativa', true)

  const { data, error } = await consulta

  if (error) return { perguntas: PERGUNTAS_PADRAO, editavel: false }

  return {
    perguntas: (data ?? []).map((p) => ({ ...p, opcoes: p.opcoes ?? [] })) as PerguntaAnamnese[],
    editavel: true,
  }
}
