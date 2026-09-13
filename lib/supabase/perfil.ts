import { cache } from 'react'

import type { Profile } from '@/lib/types'
import { createClient } from './server'

/**
 * Perfil do usuário logado. Envolvido em `cache` para que layout e página
 * do mesmo request compartilhem uma única consulta.
 */
export const getPerfilAtual = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (data as Profile | null) ?? null
})
