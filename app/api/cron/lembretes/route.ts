import { NextResponse } from "next/server";

import { enviarPush } from "@/lib/push/servidor";
import { createServiceClient } from "@/lib/supabase/servico";
import {
  diaSemanaAtual,
  ehHoje,
  hojeISO,
  horaAtual,
} from "@/lib/utils/datas";

export const dynamic = "force-dynamic";

/** Janela de cobrança da dose: nem cedo demais, nem tarde demais. */
const ATRASO_MINIMO_MIN = 10;
const ATRASO_MAXIMO_MIN = 40;

/** Horários em que o lembrete de água sai. */
const HORARIOS_DE_AGUA = ["10:00", "14:00", "17:00"];

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Roda de 15 em 15 minutos (ver `vercel.json`) e dispara três coisas:
 * remédio atrasado, lembrete de água e evento que começa em uma hora.
 *
 * O `CRON_SECRET` é obrigatório — sem ele, qualquer um na internet
 * conseguiria disparar notificação para todos os alunos.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;

  if (!segredo) {
    return NextResponse.json(
      { erro: "CRON_SECRET não configurado" },
      { status: 500 }
    );
  }

  const autorizacao = request.headers.get("authorization");
  if (autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const hoje = hojeISO();
  const agora = horaAtual();
  const agoraMin = paraMinutos(agora);
  const diaSemana = diaSemanaAtual();

  const enviados = { remedios: 0, agua: 0, eventos: 0 };

  // ── 1. Remédio vencido e não confirmado ─────────────────────────
  const [{ data: medicamentos }, { data: confirmacoes }] = await Promise.all([
    supabase
      .from("medicamentos")
      .select("id, aluno_id, nome, dose, horarios, dias_semana")
      .eq("ativo", true),
    supabase
      .from("medicamento_confirmacoes")
      .select("medicamento_id, horario")
      .eq("data", hoje),
  ]);

  const resolvidas = new Set(
    (confirmacoes ?? [])
      .filter((c) => c.horario)
      .map((c) => `${c.medicamento_id}:${c.horario}`)
  );

  for (const med of medicamentos ?? []) {
    if (!ehHoje(med.dias_semana, diaSemana)) continue;

    for (const bruto of (med.horarios as string[] | null) ?? []) {
      const horario = bruto.slice(0, 5);
      const atraso = agoraMin - paraMinutos(horario);

      // Fora da janela: ou ainda não venceu, ou já passou tempo demais e
      // insistir vira incômodo em vez de cuidado.
      if (atraso < ATRASO_MINIMO_MIN || atraso > ATRASO_MAXIMO_MIN) continue;
      if (resolvidas.has(`${med.id}:${horario}`)) continue;

      const ok = await enviarPush(med.aluno_id, {
        titulo: `Hora do ${med.nome}`,
        corpo: med.dose
          ? `${med.dose}, das ${horario}. Toque para confirmar.`
          : `Dose das ${horario}. Toque para confirmar.`,
        url: "/remedios",
        tag: `remedio-${med.id}-${horario}`,
      });

      if (ok) enviados.remedios += 1;
    }
  }

  // ── 2. Hidratação ───────────────────────────────────────────────
  if (HORARIOS_DE_AGUA.some((h) => Math.abs(agoraMin - paraMinutos(h)) < 8)) {
    const [{ data: alunos }, { data: agua }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, meta_agua_ml, avatar_condicao")
        .eq("role", "aluno")
        .not("push_subscription", "is", null),
      supabase
        .from("hidratacao_registros")
        .select("aluno_id, quantidade_ml")
        .eq("data", hoje),
    ]);

    const bebidoPorAluno = new Map<string, number>();
    for (const r of agua ?? []) {
      bebidoPorAluno.set(
        r.aluno_id,
        (bebidoPorAluno.get(r.aluno_id) ?? 0) + r.quantidade_ml
      );
    }

    for (const aluno of alunos ?? []) {
      const meta = aluno.meta_agua_ml ?? 2000;
      const bebido = bebidoPorAluno.get(aluno.id) ?? 0;

      // Já bateu a meta: não existe motivo para cobrar mais.
      if (bebido >= meta) continue;

      const ok = await enviarPush(aluno.id, {
        titulo: "Hora de beber água",
        corpo:
          bebido === 0
            ? "Você ainda não registrou água hoje. Um copo já ajuda."
            : `${(bebido / 1000).toFixed(1).replace(".", ",")} L até agora. Falta pouco para a meta.`,
        url: "/hidratacao",
        tag: "hidratacao",
      });

      if (ok) enviados.agua += 1;
    }
  }

  // ── 3. Evento que começa em uma hora ────────────────────────────
  const daquiUmaHora = new Date(Date.now() + 60 * 60_000);
  const janelaFim = new Date(Date.now() + 75 * 60_000);

  const { data: eventos } = await supabase
    .from("eventos")
    .select("id, titulo, data_inicio, para_todos, avatar_condicao")
    .gte("data_inicio", daquiUmaHora.toISOString())
    .lte("data_inicio", janelaFim.toISOString());

  for (const evento of eventos ?? []) {
    const { data: confirmados } = await supabase
      .from("evento_confirmacoes")
      .select("aluno_id")
      .eq("evento_id", evento.id)
      .eq("confirmado", true);

    for (const { aluno_id } of confirmados ?? []) {
      const ok = await enviarPush(aluno_id, {
        titulo: evento.titulo,
        corpo: "Começa em uma hora. Você confirmou presença.",
        url: "/agenda",
        tag: `evento-${evento.id}`,
      });

      if (ok) enviados.eventos += 1;
    }
  }

  return NextResponse.json({ ok: true, hoje, agora, enviados });
}
