/**
 * Recriado a cada troca de rota (diferente do layout), então cada tela entra
 * com o mesmo movimento curto de app. A animação termina em `transform: none`
 * para não virar bloco de referência dos elementos `fixed` da página.
 */
export default function AlunoTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 animate-entrar flex-col">{children}</div>;
}
