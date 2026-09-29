import { NextResponse } from "next/server";

import { despacharPendentes } from "@/lib/notificacoes/despachar";

export const dynamic = "force-dynamic";

/**
 * Chamada pelo banco (gatilho `despachar_notificacao`, via pg_net) assim que
 * uma notificação nasce. Entrega o lote pendente inteiro, não só a linha que
 * chegou: se duas chamadas se cruzarem, o `for update skip locked` da fila
 * garante que cada linha sai uma vez.
 *
 * Usa o mesmo CRON_SECRET do cron; o banco guarda uma cópia no Vault.
 */
export async function POST(request: Request) {
  const segredo = process.env.CRON_SECRET;

  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado" }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const resultado = await despacharPendentes();
  return NextResponse.json({ ok: true, ...resultado });
}
