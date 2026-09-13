/**
 * Regras de presença que a tela também precisa saber.
 *
 * Moram aqui, e não em `lib/supabase/painel-professor.ts`, porque o card do
 * aluno é client component: importar um *valor* daquele módulo arrastaria o
 * cliente de servidor (e o `next/headers` dentro dele) para o bundle do
 * navegador e o build quebra. Tipo pode atravessar, valor não.
 */

/** A partir de quantos dias sem aparecer o aluno vira preocupação. */
export const DIAS_PARA_ALERTA_DE_SUMICO = 5

/**
 * Quanto tempo para trás procuramos a última presença de cada aluno.
 *
 * Precisa ser bem maior que o limite acima: se a busca cobrisse só os cinco
 * dias, quem faltasse seis sairia da consulta justamente ao virar caso —
 * cairia como "sem presença registrada" e nunca entraria na conta de sumidos.
 */
export const DIAS_DE_HISTORICO_DE_PRESENCA = 90
