import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  FileHeart,
  Heart,
  LineChart,
  Pill,
  Scale,
  Smile,
  Droplet,
} from "lucide-react";

import { BotaoCheckin } from "@/components/aluno/BotaoCheckin";
import { CardIndicador } from "@/components/aluno/CardIndicador";
import { CardTreino } from "@/components/aluno/CardTreino";
import { RegistroHumor } from "@/components/aluno/RegistroHumor";
import { SinoNotificacoes } from "@/components/shared/SinoNotificacoes";
import { getHomeAluno } from "@/lib/supabase/home-aluno";
import { getNotificacoesAluno } from "@/lib/supabase/notificacoes";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getPresencaAluno } from "@/lib/supabase/presenca";
import { cn } from "@/lib/utils";
import { naAcademia } from "@/lib/utils/datas";
import { getMensagemAlerta } from "@/lib/utils/semaforo";

interface Foco {
  tom: "vermelho" | "amarelo" | "ciano";
  titulo: string;
  texto: string;
  acao: string;
  href: string;
}

const PONTO_TOM: Record<Foco["tom"], string> = {
  vermelho: "bg-saude-vermelho shadow-[0_0_12px_#dc2626]",
  amarelo: "bg-saude-amarelo shadow-[0_0_12px_#d97706]",
  ciano: "bg-ciano shadow-[0_0_12px_#00b4cb]",
};

export default async function HomePage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const [dados, presenca, notificacoes] = await Promise.all([
    getHomeAluno(perfil),
    getPresencaAluno(perfil.id),
    getNotificacoesAluno(perfil),
  ]);

  // Nome que veio do e-mail ("marlos.h.santos") também vira "Marlos".
  const primeiroParte = perfil.nome.trim().split(/[\s._-]+/)[0] ?? "";
  const primeiroNome = primeiroParte.charAt(0).toUpperCase() + primeiroParte.slice(1);
  const periodo = dados.saudacao.saudacao.split(",")[0];
  const inicial = primeiroNome.charAt(0).toUpperCase();
  // `hoje` já vem no fuso da academia; meio-dia UTC não vira o dia errado.
  const dataExtenso = format(new Date(`${dados.hoje}T12:00:00Z`), "EEEE, d 'de' MMMM", {
    locale: ptBR,
  });

  const glicemia = dados.indicadores.glicemia;
  const pressao = dados.indicadores.pressao;
  const peso = dados.indicadores.peso;

  const pendente = dados.remediosPendentes[0];
  const totalPendentes = dados.remediosPendentes.length;
  const treino = dados.treinoHoje;

  /*
    Indicador no vermelho merece aviso, não só o chip do card: é a diferença
    entre o aluno ver "Cuidado" de canto de olho e ler que não é para treinar
    pesado hoje.

    O peso fica de fora de propósito. O aviso diz que o professor foi
    notificado, e para peso isso seria mentira — o gatilho do banco grava
    peso sempre como verde, então ele nunca abre alerta. Fora que IMC alto
    é condição de fundo, não emergência do dia.
  */
  const criticos = Object.values(dados.indicadores).filter(
    (indicador) => indicador.status === "vermelho" && indicador.tipo !== "peso"
  );

  /*
    "Foco de hoje": uma coisa só em destaque, na ordem do que pesa mais para
    a saúde. O que sobrar de aviso aparece em linha pequena embaixo, para não
    sumir — mas sem disputar o topo.
  */
  const candidatos: Foco[] = [
    ...criticos.map((indicador) => ({
      tom: "vermelho" as const,
      titulo: "Atenção antes de treinar",
      texto: getMensagemAlerta(
        indicador.tipo,
        indicador.status,
        indicador.valorPrincipal,
        indicador.valorSecundario ?? undefined
      ),
      acao: "Medir de novo",
      href: "/indicadores",
    })),
    ...(pendente
      ? [
          {
            tom: "amarelo" as const,
            titulo: "Remédio esperando confirmação",
            texto: `${pendente.nome}${pendente.dose ? ` (${pendente.dose})` : ""} das ${pendente.horario} ainda não foi marcado${
              totalPendentes > 1 ? `, e há mais ${totalPendentes - 1} na fila` : ""
            }.`,
            acao: "Confirmar dose",
            href: "/remedios",
          },
        ]
      : []),
    ...(treino && !treino.concluido
      ? [
          {
            tom: "ciano" as const,
            titulo: treino.seriesFeitas > 0 ? "Seu treino está pela metade" : "Hoje tem treino",
            texto:
              treino.seriesFeitas > 0
                ? `${treino.nome}: ${treino.seriesFeitas} de ${treino.totalSeries} séries feitas. Continue de onde parou.`
                : `${treino.nome}, com ${treino.totalExercicios} ${treino.totalExercicios === 1 ? "exercício" : "exercícios"}. Seu professor já deixou tudo pronto.`,
            acao: treino.seriesFeitas > 0 ? "Continuar treino" : "Começar treino",
            href: "/treino",
          },
        ]
      : []),
    ...(!dados.humorHoje
      ? [
          {
            tom: "ciano" as const,
            titulo: "Como você acordou?",
            texto: "Um toque para contar ao seu professor como está o dia. Ele ajusta o treino se precisar.",
            acao: "Registrar humor",
            href: "#humor",
          },
        ]
      : []),
  ];

  const foco: Foco = candidatos[0] ?? {
    tom: "ciano",
    titulo: "Dia em ordem",
    texto: "Remédios em dia, humor registrado e nada fora da faixa. Lembre de beber água ao longo do dia.",
    acao: "Registrar água",
    href: "/hidratacao",
  };
  const outrosAvisos = candidatos.slice(1).filter((c) => c.tom !== "ciano");

  const acessoRapido = [
    {
      href: "/remedios",
      icone: Pill,
      titulo: "Remédios",
      subtitulo:
        totalPendentes > 0
          ? `${totalPendentes} pendente${totalPendentes > 1 ? "s" : ""} hoje`
          : "Tudo em dia",
    },
    {
      href: "/evolucao",
      icone: LineChart,
      titulo: "Evolução",
      subtitulo:
        dados.totalIndicadores > 0
          ? `${dados.totalIndicadores} registros`
          : "Sem registros",
    },
    {
      href: "/humor",
      icone: Smile,
      titulo: "Bem-estar",
      subtitulo: dados.humorHoje ? "Humor registrado" : "Humor não registrado",
    },
    {
      // No celular não há outra porta para os exames: a barra de baixo tem só 5 abas.
      href: "/exames",
      icone: FileHeart,
      titulo: "Exames",
      subtitulo: "Guardar e compartilhar",
    },
    {
      href: "/agenda",
      icone: CalendarDays,
      titulo: "Agenda",
      subtitulo: dados.proximoEvento
        ? format(naAcademia(dados.proximoEvento.dataInicio), "EEE dd/MM", {
            locale: ptBR,
          })
        : "Nada marcado",
    },
  ];

  // Função e não componente: sino e avatar aparecem em dois lugares (celular e desktop).
  const acoes = (className: string) => (
    <div className={cn("items-center gap-2", className)}>
      <SinoNotificacoes itens={notificacoes} usuarioId={perfil.id} papel="aluno" />
      <Link
        href="/perfil"
        aria-label="Meu perfil"
        className="numero flex size-11 items-center justify-center rounded-full bg-grafite text-base font-semibold text-white"
      >
        {inicial}
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-7 px-5 pt-4 md:gap-9 md:px-8 md:pt-10">
      {/* ── Topo do celular: símbolo e atalhos ───────────────────── */}
      <div className="flex items-center justify-between md:hidden">
        <Image
          src="/marca/simbolo.png"
          alt="Atitude Vital"
          width={512}
          height={512}
          priority
          sizes="36px"
          className="size-9"
        />
        {acoes("flex")}
      </div>

      {/* ── Saudação ─────────────────────────────────────────────── */}
      <header data-tour="saudacao" className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="rotulo text-neutral-400 first-letter:uppercase">{dataExtenso}</p>
          <h1 className="mt-2 text-[32px] leading-[1.05] font-semibold tracking-[-0.035em] text-neutral-950 md:text-[44px]">
            {periodo}, {primeiroNome}
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-neutral-500 md:text-base">
            {dados.saudacao.frase}
          </p>
        </div>
        {acoes("hidden md:flex")}
      </header>

      {/* ── Foco de hoje + check-in ──────────────────────────────── */}
      <section className="grid gap-3 md:grid-cols-[1.45fr_1fr] md:gap-4">
        <div data-tour="foco" className="relative flex flex-col overflow-hidden rounded-[26px] bg-grafite p-5 text-white md:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-[radial-gradient(circle,rgba(0,180,203,.28),transparent_65%)]"
          />
          <p className="rotulo relative flex items-center gap-2 text-[#5fd3e2]">
            <span className={cn("size-2 rounded-full", PONTO_TOM[foco.tom])} />
            Foco de hoje
          </p>
          <h2 className="relative mt-3 text-[22px] leading-tight font-semibold tracking-[-0.025em] md:text-[26px]">
            {foco.titulo}
          </h2>
          <p className="relative mt-2 max-w-lg text-[15px] leading-relaxed text-white/65">
            {foco.texto}
          </p>

          <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href={foco.href}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-ciano pr-4 pl-5 text-[15px] font-semibold text-grafite transition-colors hover:bg-[#2cc4d8]"
            >
              {foco.acao}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>

          {outrosAvisos.length > 0 && (
            <ul className="relative mt-5 flex flex-col border-t border-white/10 pt-3">
              {outrosAvisos.map((aviso) => (
                <li key={aviso.titulo + aviso.texto}>
                  <Link
                    href={aviso.href}
                    className="flex items-center gap-2.5 py-1.5 text-sm text-white/70 transition-colors hover:text-white"
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", PONTO_TOM[aviso.tom])} />
                    <span className="min-w-0 flex-1 truncate">{aviso.texto}</span>
                    <ChevronRight className="size-4 shrink-0 text-white/40" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div data-tour="checkin" className="flex flex-col gap-3 md:gap-4">
          <BotaoCheckin
            alunoId={perfil.id}
            hoje={dados.hoje}
            checkinInicial={presenca.checkinDeHoje}
            presentesAgora={presenca.presentesAgora}
            sequencia={presenca.sequencia}
            primeiroNome={primeiroNome}
            temTreinoHoje={Boolean(treino && !treino.concluido)}
          />
          <div className="flex-1">
            <CardTreino treino={treino} />
          </div>
        </div>
      </section>

      {/* ── Indicadores ──────────────────────────────────────────── */}
      <section data-tour="indicadores" className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Seus indicadores
          </h2>
          <Link href="/indicadores" className="text-sm font-semibold text-primary hover:underline underline-offset-4">
            Ver histórico
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <CardIndicador
            icone={Heart}
            valor={pressao?.valorFormatado ?? ""}
            unidade="mmHg"
            label="Pressão"
            status={pressao?.status}
            href="/indicadores"
            faixa={
              pressao
                ? { tipo: "pressao", valor: pressao.valorPrincipal, valorSecundario: pressao.valorSecundario }
                : undefined
            }
          />
          <CardIndicador
            icone={Droplet}
            valor={glicemia?.valorFormatado ?? ""}
            unidade="mg/dL"
            label="Glicemia"
            status={glicemia?.status}
            href="/indicadores"
            faixa={glicemia ? { tipo: "glicemia", valor: glicemia.valorPrincipal } : undefined}
          />
          <CardIndicador
            icone={Scale}
            valor={peso ? peso.valorFormatado.replace(" kg", "") : ""}
            unidade="kg"
            label="Peso"
            status={peso?.status}
            badge={peso?.badge}
            href="/indicadores"
            faixa={peso?.imc ? { tipo: "peso", valor: peso.imc } : undefined}
          />
          <CardIndicador
            icone={Dumbbell}
            valor={
              dados.treinosPlanejados > 0
                ? `${dados.treinosNaSemana}/${dados.treinosPlanejados}`
                : String(dados.treinosNaSemana)
            }
            unidade="treinos"
            label="Semana"
            status={
              dados.treinosPlanejados === 0
                ? undefined
                : dados.treinosNaSemana >= dados.treinosPlanejados
                  ? "verde"
                  : dados.treinosNaSemana >= dados.treinosPlanejados / 2
                    ? "amarelo"
                    : "vermelho"
            }
            badge={
              dados.treinosPlanejados > 0
                ? dados.treinosNaSemana >= dados.treinosPlanejados
                  ? "Completa"
                  : "Em andamento"
                : undefined
            }
            href="/evolucao"
            progresso={{ feitos: dados.treinosNaSemana, total: dados.treinosPlanejados }}
          />
        </div>
      </section>

      {/* ── Humor + atalhos ──────────────────────────────────────── */}
      <div data-tour="humor" className="grid gap-3 md:grid-cols-2 md:gap-4">
        <RegistroHumor alunoId={perfil.id} hoje={dados.hoje} humorInicial={dados.humorHoje} />

        <nav
          aria-label="Atalhos"
          className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90"
        >
          {acessoRapido.map(({ href, icone: Icone, titulo, subtitulo }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-1 items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-neutral-50"
            >
              <Icone className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
              <span className="flex-1 text-[15px] font-semibold text-neutral-950">{titulo}</span>
              <span className="text-sm text-neutral-500 first-letter:uppercase">{subtitulo}</span>
              <ChevronRight
                className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
