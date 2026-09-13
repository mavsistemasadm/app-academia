import { redirect } from "next/navigation";

import { getPerfilAtual } from "@/lib/supabase/perfil";

/**
 * O chat fica fora dos grupos `(aluno)` e `(professor)` de propósito: é a
 * única tela que os dois papéis abrem do mesmo jeito, e duplicá-la só para
 * casar com a navegação de cada um sairia mais caro do que este layout.
 */
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-neutral-100">
      {children}
    </div>
  );
}
