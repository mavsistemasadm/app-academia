/**
 * Retorno tátil curto, como o de app nativo. Android vibra; iPhone ignora em
 * silêncio (o Safari não expõe vibração) — nunca quebra.
 *
 * - `leve`: marcar série, escolher humor, trocar aba.
 * - `sucesso`: check-in, treino concluído, dose confirmada.
 */
export function vibrar(tipo: "leve" | "sucesso" = "leve") {
  try {
    navigator.vibrate?.(tipo === "sucesso" ? [30, 50, 30] : 12);
  } catch {
    // Navegador sem permissão ou sem suporte: segue sem vibrar.
  }
}
