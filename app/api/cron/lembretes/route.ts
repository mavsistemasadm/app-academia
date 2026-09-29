import { NextResponse } from "next/server";

import { despacharPendentes } from "@/lib/notificacoes/despachar";
import {
  alertarDosesEsquecidas,
  alertarSumidos,
  avisarConquistas,
  enviarResumoMensal,
  enviarResumoSemanal,
} from "@/lib/notificacoes/rotinas";
import { enviarPush } from "@/lib/push/servidor";
import { createServiceClient } from "@/lib/supabase/servico";
import {
  diaSemanaAtual,
  ehHoje,
  hojeISO,
  horaAtual,
  horaCheiaAtual,
} from "@/lib/utils/datas";

export const dynamic = "force-dynamic";
// As rotinas das 8h e 9h percorrem todos os alunos; 15 s não bastam.
export const maxDuration = 300;

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
 * Roda de 15 em 15 minutos (ver `vercel.json`) e dispara: medicamento
 * atrasado, lembrete de água, evento e aula que começam em uma hora. Numa
 * hora fixa do dia roda também as rotinas de `lib/notificacoes/rotinas.ts`
 * (sumidos, doses esquecidas, conquistas, resumos) e, a cada volta, entrega
 * o que tiver ficado para trás na fila de notificações.
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

  const enviados = { medicamentos: 0, agua: 0, eventos: 0, aulas: 0 };

  // ── 1. Medicamento vencido e não confirmado ─────────────────────────
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
        url: "/medicamentos",
        tag: `medicamento-${med.id}-${horario}`,
      });

      if (ok) enviados.medicamentos += 1;
    }
  }

  // ── 2. Hidratação ───────────────────────────────────────────────
  if (HORARIOS_DE_AGUA.some((h) => Math.abs(agoraMin - paraMinutos(h)) < 8)) {
    const [{ data: alunos }, { data: agua }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, meta_agua_ml, avatar_condicao")
        .eq("role", "aluno")
        // Conta desativada (quem saiu da equipe) não entra na lista.
        .not("ativo", "is", false)
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

  // ── 4. Aula marcada que começa em uma hora ──────────────────────
  const { data: inscricoes } = await supabase
    .from("aula_inscricoes")
    .select("aluno_id, horario_id, data, aulas_horarios(titulo, hora, local, ativo)")
    .eq("data", hoje);

  type InscricaoComAula = {
    aluno_id: string;
    horario_id: string;
    data: string;
    aulas_horarios:
      | { titulo: string; hora: string; local: string | null; ativo: boolean }
      | { titulo: string; hora: string; local: string | null; ativo: boolean }[]
      | null;
  };

  const emUmaHora = (inscricoes ?? []) as InscricaoComAula[];

  // Aula cancelada não lembra ninguém: o aviso já saiu pelo sininho.
  const cancelados = new Set<string>();
  if (emUmaHora.length > 0) {
    const { data: cancelamentos } = await supabase
      .from("aula_cancelamentos")
      .select("horario_id")
      .eq("data", hoje);
    for (const c of cancelamentos ?? []) cancelados.add(c.horario_id as string);
  }

  for (const inscricao of emUmaHora) {
    if (cancelados.has(inscricao.horario_id)) continue;

    const aula = Array.isArray(inscricao.aulas_horarios)
      ? inscricao.aulas_horarios[0]
      : inscricao.aulas_horarios;
    // Horário desligado da grade não acontece, mesmo com inscrição antiga.
    if (!aula || aula.ativo === false) continue;

    const minutosDaAula = paraMinutos(aula.hora.slice(0, 5));
    const faltam = minutosDaAula - agoraMin;

    // A janela é a do cron: roda a cada 15 minutos.
    if (faltam < 53 || faltam > 68) continue;

    const ok = await enviarPush(inscricao.aluno_id, {
      titulo: `${aula.titulo} às ${aula.hora.slice(0, 5)}`,
      corpo: `Começa em uma hora${aula.local ? ` · ${aula.local}` : ""}. Sua vaga está garantida.`,
      url: "/aulas",
      tag: `aula-${inscricao.horario_id}-${inscricao.data}`,
    });

    if (ok) enviados.aulas += 1;
  }

  // ── 5. Rotinas do dia ─────────────────────────────────────────────
  // Cada uma roda nas quatro voltas da sua hora; a chave do aviso e a
  // checagem de alerta aberto seguram a repetição. Uma falha não derruba as
  // outras nem os lembretes acima.
  const hora = horaCheiaAtual();
  const rotinas: Record<string, number | string> = {};

  async function rodar(nome: string, tarefa: () => Promise<number>) {
    try {
      rotinas[nome] = await tarefa();
    } catch (erro) {
      console.error(`rotina ${nome}:`, erro);
      rotinas[nome] = "erro";
    }
  }

  if (hora === 8) {
    await rodar("sumidos", () => alertarSumidos(supabase));
    await rodar("doses", () => alertarDosesEsquecidas(supabase));
    if (diaSemana === "seg") await rodar("resumoSemanal", () => enviarResumoSemanal(supabase));
  }
  if (hora === 9) {
    await rodar("conquistas", () => avisarConquistas(supabase));
    if (hoje.endsWith("-01")) await rodar("resumoMensal", () => enviarResumoMensal(supabase));
  }

  // ── 6. Fila de notificações ───────────────────────────────────────
  // O banco já chama a entrega na hora; aqui é a rede de segurança.
  const fila = await despacharPendentes(100);

  return NextResponse.json({ ok: true, hoje, agora, enviados, rotinas, fila });
}
