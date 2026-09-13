import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Droplet,
  Flame,
  Heart,
  LineChart,
  Pill,
  Scale,
  Smile,
} from "lucide-react";

import { BotaoCheckin } from "@/components/aluno/BotaoCheckin";
import { CardIndicador } from "@/components/aluno/CardIndicador";
import { CardTreino } from "@/components/aluno/CardTreino";
import { RegistroHumor } from "@/components/aluno/RegistroHumor";
import { getHomeAluno } from "@/lib/supabase/home-aluno";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { getPresencaAluno } from "@/lib/supabase/presenca";
import { getMensagemAlerta } from "@/lib/utils/semaforo";

export default async function HomePage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const [dados, presenca] = await Promise.all([
    getHomeAluno(perfil),
    getPresencaAluno(perfil.id),
  ]);

  const primeiroNome = perfil.nome.split(" ")[0];
  const periodo = dados.saudacao.saudacao.split(",")[0];
  const inicial = primeiroNome.charAt(0).toUpperCase();

  const glicemia = dados.indicadores.glicemia;
  const pressao = dados.indicadores.pressao;
  const peso = dados.indicadores.peso;

  const pendente = dados.remediosPendentes[0];
  const totalPendentes = dados.remediosPendentes.length;

  /*
    Indicador no vermelho merece aviso, não só o selo pequeno do card: é a
    diferença entre o aluno ver "Cuidado" de canto de olho e ler que não é
    para treinar pesado hoje.

    O peso fica de fora de propósito. O aviso diz que o professor foi
    notificado, e para peso isso seria mentira — o gatilho do banco grava
    peso sempre como verde, então ele nunca abre alerta. Fora que IMC alto
    é condição de fundo, não emergência do dia: o card já mostra o número,
    e a casa não trata peso como coisa de alarme.
  */
  const criticos = Object.values(dados.indicadores).filter(
    (indicador) => indicador.status === "vermelho" && indicador.tipo !== "peso"
  );

  const temAviso = criticos.length > 0 || Boolean(pendente);

  const acessoRapido = [
    {
      href: "/remedios",
      icone: Pill,
      cor: "bg-violet-50 text-violet-600",
      titulo: "Remédios",
      subtitulo:
        totalPendentes > 0
          ? `${totalPendentes} pendente${totalPendentes > 1 ? "s" : ""} hoje`
          : "Tudo em dia",
    },
    {
      href: "/evolucao",
      icone: LineChart,
      cor: "bg-blue-50 text-primary",
      titulo: "Evolução",
      subtitulo:
        dados.totalIndicadores > 0
          ? `${dados.totalIndicadores} registros`
          : "Sem registros",
    },
    {
      href: "/humor",
      icone: Smile,
      cor: "bg-amber-50 text-amber-600",
      titulo: "Bem-estar",
      subtitulo: dados.humorHoje ? "Registrado hoje" : "Não registrado",
    },
    {
      href: "/agenda",
      icone: CalendarDays,
      cor: "bg-emerald-50 text-saude-verde",
      titulo: "Agenda",
      subtitulo: dados.proximoEvento
        ? format(new Date(dados.proximoEvento.dataInicio), "EEE dd/MM", {
            locale: ptBR,
          })
        : "Nada marcado",
    },
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-white/20 text-lg font-semibold md:hidden">
              {inicial}
            </div>
            <p className="text-base text-white/80">{periodo},</p>
            <h1 className="text-3xl font-bold tracking-tight">
              {primeiroNome}
            </h1>
            <p className="mt-2 max-w-xl text-base text-white/90">
              {dados.saudacao.frase}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/agenda"
              aria-label="Notificações"
              className="flex size-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15"
            >
              <Bell className="size-6" aria-hidden />
            </Link>
            <div className="hidden size-11 items-center justify-center rounded-full bg-white/20 text-lg font-semibold md:flex">
              {inicial}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {/* ── 2. Avisos: indicador crítico e remédio pendente ──── */}
        {temAviso && (
        <div className="-mt-14 flex flex-col gap-3 md:mt-0">
        {criticos.map((indicador) => (
          <Link
            key={indicador.id}
            href="/indicadores"
            className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 transition-colors hover:bg-red-100"
          >
            <span
              className="size-2.5 shrink-0 rounded-full bg-saude-vermelho"
              aria-hidden
            />
            <p className="min-w-0 flex-1 text-sm font-medium text-red-900">
              {getMensagemAlerta(
                indicador.tipo,
                indicador.status,
                indicador.valorPrincipal,
                indicador.valorSecundario ?? undefined
              )}
            </p>
            <ChevronRight className="size-5 shrink-0 text-red-600" aria-hidden />
          </Link>
        ))}

        {pendente && (
          <Link
            href="/remedios"
            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 transition-colors hover:bg-amber-100"
          >
            <span
              className="size-2.5 shrink-0 rounded-full bg-saude-amarelo"
              aria-hidden
            />
            <p className="min-w-0 flex-1 text-sm font-medium text-amber-900">
              {pendente.nome} das {pendente.horario} ainda não confirmado
              {totalPendentes > 1 && (
                <span className="font-normal text-amber-700">
                  {" "}
                  · +{totalPendentes - 1}
                </span>
              )}
            </p>
            <ChevronRight className="size-5 shrink-0 text-amber-600" aria-hidden />
          </Link>
        )}
        </div>
        )}

        {/* ── 3. Check-in ──────────────────────────────────────── */}
        <div className={temAviso ? undefined : "-mt-14 md:mt-0"}>
          <BotaoCheckin
            alunoId={perfil.id}
            hoje={dados.hoje}
            checkinInicial={presenca.checkinDeHoje}
            presentesAgora={presenca.presentesAgora}
          />
        </div>

        {/* ── 4. Indicadores ───────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Seus indicadores
          </h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <CardIndicador
              icone={Droplet}
              corIcone="bg-blue-50 text-primary"
              valor={glicemia?.valorFormatado ?? ""}
              label="Glicemia mg/dL"
              status={glicemia?.status}
              href="/indicadores"
            />
            <CardIndicador
              icone={Heart}
              corIcone="bg-rose-50 text-rose-600"
              valor={pressao?.valorFormatado ?? ""}
              label="Pressão mmHg"
              status={pressao?.status}
              href="/indicadores"
            />
            <CardIndicador
              icone={Scale}
              corIcone="bg-emerald-50 text-saude-verde"
              valor={peso?.valorFormatado ?? ""}
              label="Peso atual"
              status={peso?.status}
              badge={peso?.badge}
              href="/indicadores"
            />
            <CardIndicador
              icone={Flame}
              corIcone="bg-orange-50 text-orange-600"
              valor={
                dados.treinosPlanejados > 0
                  ? `${dados.treinosNaSemana}/${dados.treinosPlanejados}`
                  : String(dados.treinosNaSemana)
              }
              label="Treinos na semana"
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
                dados.treinosPlanejados > 0 &&
                dados.treinosNaSemana >= dados.treinosPlanejados
                  ? "Excelente"
                  : undefined
              }
              href="/evolucao"
            />
          </div>
        </section>

        {/* ── 4 e 5. Treino e humor ────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2 md:gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Treino de hoje
            </h2>
            <CardTreino treino={dados.treinoHoje} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Como você está?
            </h2>
            <RegistroHumor
              alunoId={perfil.id}
              hoje={dados.hoje}
              humorInicial={dados.humorHoje}
            />
          </section>
        </div>

        {/* ── 6. Acesso rápido ─────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Acesso rápido
          </h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {acessoRapido.map(({ href, icone: Icone, cor, titulo, subtitulo }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-lg ${cor}`}
                >
                  <Icone className="size-5" aria-hidden />
                </span>
                <p className="text-sm font-semibold text-neutral-900">
                  {titulo}
                </p>
                <p className="text-xs text-neutral-500">{subtitulo}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
