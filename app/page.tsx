import { redirect } from "next/navigation";

/**
 * A raiz não tem tela própria: o middleware já manda quem está logado para
 * /home ou /dashboard, então aqui só resta o fluxo de entrada.
 */
export default function Page() {
  redirect("/login");
}
