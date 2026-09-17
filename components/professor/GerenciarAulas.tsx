"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { AulaNoDia, HorarioDaGrade, InscritoNaAula } from "@/lib/supabase/aulas";
import { AVATAR_OPCOES } from "@/lib/utils/avatares";
import { DIAS_DA_GRADE, horaCurta, horaFim, vagasRestantes } from "@/lib/utils/aulas";

const TITULO_SECAO = "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";
const CARD_LISTA =
  "divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90";
const CAMPO = "h-12 rounded-[14px] px-4 text-base";

interface GerenciarAulasProps {
  professorId: string;
  grade: HorarioDaGrade[];
  /** Aulas dos próximos dias, já com vagas ocupadas. */
  proximas: AulaNoDia[];
  inscritos: Record<string, InscritoNaAula[]>;
  indisponivel: boolean;
}

export function GerenciarAulas({
  professorId,
  grade,
  proximas,
  inscritos,
  indisponivel,
}: GerenciarAulasProps) {
  const router = useRouter();
  const [editando, setEditando] = useState<HorarioDaGrade | "novo" | null>(null);
  const [abertas, setAbertas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  async function executar(acao: () => PromiseLike<{ error: unknown } | void>) {
    setErro(null);
    setOcupado(true);
    const r = await acao();
    setOcupado(false);

    if (r && r.error) {
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }
    iniciarTransicao(() => router.refresh());
  }

  function alternarAtivo(horario: HorarioDaGrade) {
    executar(() =>
      createClient()
        .from("aulas_horarios")
        .update({ ativo: !horario.ativo, updated_at: new Date().toISOString() })
        .eq("id", horario.id)
    );
  }

  function excluirHorario(horario: HorarioDaGrade) {
    executar(() => createClient().from("aulas_horarios").delete().eq("id", horario.id));
  }

  function cancelarAula(aula: AulaNoDia, motivo: string) {
    executar(() =>
      createClient()
        .from("aula_cancelamentos")
        .insert({ horario_id: aula.horarioId, data: aula.data, motivo: motivo.trim() || null })
    );
  }

  function reabrirAula(aula: AulaNoDia) {
    executar(() =>
      createClient()
        .from("aula_cancelamentos")
        .delete()
        .eq("horario_id", aula.horarioId)
        .eq("data", aula.data)
    );
  }

  function tirarAluno(inscricaoId: string) {
    executar(() => createClient().from("aula_inscricoes").delete().eq("id", inscricaoId));
  }

  const porDia = DIAS_DA_GRADE.map((dia) => ({
    ...dia,
    horarios: grade.filter((h) => h.diaSemana === dia.valor),
  })).filter((d) => d.horarios.length > 0);

  return (
    <div className="flex flex-col gap-7">
      {indisponivel && (
        <div className="flex items-start gap-3 rounded-2xl bg-saude-amarelo-light px-5 py-4 text-sm leading-relaxed text-neutral-800">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-saude-amarelo" strokeWidth={1.8} aria-hidden />
          <p>As aulas estão sendo ativadas no banco. Volte daqui a pouco.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => setEditando("novo")}
          disabled={indisponivel || ocupado}
          className="h-11 rounded-full px-5 font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          Novo horário
        </Button>
        {ocupado && <Loader2 className="size-4 animate-spin text-neutral-400" aria-label="Salvando" />}
      </div>

      {erro && (
        <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      {/* ── Próximas aulas, com quem marcou ─────────────────────────── */}
      <section className="flex flex-col gap-3.5">
        <div>
          <h2 className={TITULO_SECAO}>Próximas aulas</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
            Quem já marcou, quantas vagas sobraram e o botão para avisar que a aula não vai
            acontecer.
          </p>
        </div>

        {proximas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
            <CalendarDays className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
            <p className="text-[15px] font-semibold text-neutral-950">Nada nos próximos dias</p>
            <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
              Crie um horário na grade e ele passa a se repetir toda semana.
            </p>
          </div>
        ) : (
          <ul className={CARD_LISTA}>
            {proximas.map((aula) => {
              const chave = `${aula.horarioId}:${aula.data}`;
              const lista = inscritos[chave] ?? [];
              const aberta = abertas.includes(chave);
              const restantes = vagasRestantes(aula.vagas, aula.ocupadas);

              return (
                <li key={chave} className="flex flex-col">
                  <div className="flex items-center gap-4 px-4 py-3.5 md:px-5">
                    <div className="w-16 shrink-0 border-r border-neutral-200/80 pr-3">
                      <p className="rotulo text-primary">
                        {format(new Date(`${aula.data}T12:00:00Z`), "EEE dd/MM", { locale: ptBR })}
                      </p>
                      <p className="numero mt-0.5 text-[17px] leading-none font-semibold text-neutral-950">
                        {horaCurta(aula.hora)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAbertas((atuais) =>
                          aberta ? atuais.filter((c) => c !== chave) : [...atuais, chave]
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-expanded={aberta}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-neutral-950">
                          {aula.titulo}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-neutral-500">
                          <span className="flex items-center gap-1.5">
                            <Users className="size-3.5 text-neutral-400" strokeWidth={1.8} aria-hidden />
                            <span className="numero font-semibold text-neutral-950">
                              {aula.ocupadas}
                            </span>
                            de {aula.vagas} marcados
                          </span>
                          {aula.cancelada ? (
                            <span className="font-semibold text-saude-vermelho">Cancelada</span>
                          ) : (
                            restantes === 0 && <span className="font-semibold">Lotada</span>
                          )}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-neutral-400 transition-transform",
                          aberta && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </button>
                  </div>

                  {aberta && (
                    <div className="flex flex-col gap-3 border-t border-neutral-200/80 bg-neutral-50 px-4 py-3.5 md:px-5">
                      {lista.length === 0 ? (
                        <p className="text-[13px] text-neutral-500">Ninguém marcou ainda.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {lista.map((inscrito) => (
                            <li key={inscrito.inscricaoId} className="flex items-center gap-2.5">
                              <span className="numero flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-[13px] font-semibold text-neutral-600">
                                {inscrito.fotoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={inscrito.fotoUrl} alt="" className="size-full object-cover" />
                                ) : (
                                  inscrito.nome.charAt(0).toUpperCase()
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
                                {inscrito.nome}
                              </span>
                              <button
                                type="button"
                                onClick={() => tirarAluno(inscrito.inscricaoId)}
                                disabled={ocupado}
                                aria-label={`Tirar ${inscrito.nome} desta aula`}
                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-saude-vermelho-light hover:text-saude-vermelho"
                              >
                                <UserMinus className="size-4" strokeWidth={1.9} aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {aula.cancelada ? (
                        <button
                          type="button"
                          onClick={() => reabrirAula(aula)}
                          disabled={ocupado}
                          className="w-fit text-sm font-semibold text-primary"
                        >
                          Reabrir esta aula
                        </button>
                      ) : (
                        <BotaoCancelarAula onCancelar={(motivo) => cancelarAula(aula, motivo)} ocupado={ocupado} />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Grade da semana ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3.5">
        <div>
          <h2 className={TITULO_SECAO}>Grade da semana</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
            Cada horário aqui se repete toda semana. Desligar tira da agenda do aluno sem apagar o
            histórico.
          </p>
        </div>

        {porDia.length === 0 ? (
          <div className="rounded-2xl bg-card px-5 py-6 ring-1 ring-neutral-200/90">
            <p className="text-[15px] font-semibold text-neutral-950">Grade vazia</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">
              Comece por um horário fixo, por exemplo terça às 18h, funcional, 12 vagas.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {porDia.map((dia) => (
              <div key={dia.valor} className="flex flex-col gap-2.5">
                <p className="rotulo text-neutral-400">{dia.longo}</p>
                <ul className={CARD_LISTA}>
                  {dia.horarios.map((horario) => (
                    <li key={horario.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                      <p className="numero w-14 shrink-0 text-[15px] font-semibold text-neutral-950">
                        {horaCurta(horario.hora)}
                      </p>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-[15px] font-semibold",
                            horario.ativo ? "text-neutral-950" : "text-neutral-400 line-through"
                          )}
                        >
                          {horario.titulo}
                        </p>
                        <p className="text-[13px] text-neutral-500">
                          até {horaFim(horario.hora, horario.duracaoMin)} · {horario.vagas} vagas
                          {horario.local ? ` · ${horario.local}` : ""}
                          {!horario.paraTodos && horario.condicoes.length > 0
                            ? ` · ${horario.condicoes.length} ${horario.condicoes.length === 1 ? "condição" : "condições"}`
                            : ""}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => alternarAtivo(horario)}
                        disabled={ocupado}
                        aria-label={horario.ativo ? "Desligar horário" : "Ligar horário"}
                        title={horario.ativo ? "Desligar" : "Ligar"}
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full ring-1 ring-neutral-200 transition-colors",
                          horario.ativo
                            ? "text-neutral-500 hover:text-neutral-950"
                            : "text-neutral-300 hover:text-neutral-600"
                        )}
                      >
                        <Power className="size-4" strokeWidth={1.9} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(horario)}
                        disabled={ocupado}
                        aria-label={`Editar ${horario.titulo}`}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-500 ring-1 ring-neutral-200 transition-colors hover:text-neutral-950"
                      >
                        <Pencil className="size-4" strokeWidth={1.9} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirHorario(horario)}
                        disabled={ocupado}
                        aria-label={`Excluir ${horario.titulo}`}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-400 ring-1 ring-neutral-200 transition-colors hover:bg-saude-vermelho-light hover:text-saude-vermelho hover:ring-transparent"
                      >
                        <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {editando && (
        <DialogHorario
          key={editando === "novo" ? "novo" : editando.id}
          professorId={professorId}
          horario={editando === "novo" ? null : editando}
          onFechar={() => setEditando(null)}
          onPronto={() => {
            setEditando(null);
            iniciarTransicao(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

function BotaoCancelarAula({
  onCancelar,
  ocupado,
}: {
  onCancelar: (motivo: string) => void;
  ocupado: boolean;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!abrindo) {
    return (
      <button
        type="button"
        onClick={() => setAbrindo(true)}
        className="w-fit text-sm font-semibold text-saude-vermelho"
      >
        Cancelar esta aula
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (opcional): feriado, manutenção…"
        className="h-11 max-w-xs rounded-[14px] px-4 text-base"
      />
      <Button
        type="button"
        variant="escuro"
        disabled={ocupado}
        onClick={() => {
          onCancelar(motivo);
          setAbrindo(false);
        }}
        className="h-11 rounded-full px-5 font-semibold"
      >
        <Check className="size-4" aria-hidden />
        Avisar a turma
      </Button>
      <button
        type="button"
        onClick={() => setAbrindo(false)}
        className="text-sm font-medium text-neutral-500"
      >
        Deixar como está
      </button>
    </div>
  );
}

function DialogHorario({
  professorId,
  horario,
  onFechar,
  onPronto,
}: {
  professorId: string;
  horario: HorarioDaGrade | null;
  onFechar: () => void;
  onPronto: () => void;
}) {
  const [titulo, setTitulo] = useState(horario?.titulo ?? "");
  const [local, setLocal] = useState(horario?.local ?? "");
  const [dias, setDias] = useState<number[]>(horario ? [horario.diaSemana] : []);
  const [hora, setHora] = useState(horario ? horaCurta(horario.hora) : "18:00");
  const [duracao, setDuracao] = useState(String(horario?.duracaoMin ?? 60));
  const [vagas, setVagas] = useState(String(horario?.vagas ?? 12));
  const [paraTodos, setParaTodos] = useState(horario?.paraTodos ?? true);
  const [condicoes, setCondicoes] = useState<string[]>(horario?.condicoes ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (titulo.trim().length < 2) return setErro("Dê um nome à aula.");
    if (dias.length === 0) return setErro("Escolha pelo menos um dia da semana.");
    if (!/^\d{2}:\d{2}$/.test(hora)) return setErro("Informe o horário, por exemplo 18:00.");
    if (Number(vagas) < 1) return setErro("A aula precisa de pelo menos uma vaga.");
    if (!paraTodos && condicoes.length === 0) {
      return setErro("Escolha as condições ou deixe a aula para todos.");
    }

    setSalvando(true);
    const supabase = createClient();

    const base = {
      titulo: titulo.trim(),
      local: local.trim() || null,
      hora: `${hora}:00`,
      duracao_min: Math.max(1, Number(duracao) || 60),
      vagas: Math.max(1, Number(vagas) || 1),
      para_todos: paraTodos,
      avatar_condicao: paraTodos ? null : condicoes,
      updated_at: new Date().toISOString(),
    };

    // Um horário por dia escolhido: a grade é semanal, então "seg e qua às
    // 18h" são duas linhas que o professor edita separadamente depois.
    const { error } = horario
      ? await supabase
          .from("aulas_horarios")
          .update({ ...base, dia_semana: dias[0] })
          .eq("id", horario.id)
      : await supabase.from("aulas_horarios").insert(
          dias.map((dia) => ({
            ...base,
            dia_semana: dia,
            professor_id: professorId,
          }))
        );

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }

    onPronto();
  }

  return (
    <Dialog open onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={salvar} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{horario ? "Editar horário" : "Novo horário"}</DialogTitle>
            <DialogDescription>
              O horário se repete toda semana. O aluno marca o dia que quiser, até acabarem as
              vagas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="au-titulo" className="text-neutral-700">
              Nome da aula
            </Label>
            <Input
              id="au-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Funcional, pilates, treino em grupo…"
              disabled={salvando}
              autoFocus={!horario}
              className={CAMPO}
            />
          </div>

          <fieldset className="flex flex-col gap-2.5" disabled={salvando}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">
              {horario ? "Dia da semana" : "Dias da semana"}
            </legend>
            <div className="flex flex-wrap gap-2">
              {DIAS_DA_GRADE.map((dia) => {
                const marcado = dias.includes(dia.valor);
                return (
                  <button
                    key={dia.valor}
                    type="button"
                    onClick={() =>
                      setDias((atuais) =>
                        horario
                          ? [dia.valor]
                          : marcado
                            ? atuais.filter((d) => d !== dia.valor)
                            : [...atuais, dia.valor]
                      )
                    }
                    aria-pressed={marcado}
                    className={cn(
                      "size-12 rounded-full text-sm font-medium transition-all duration-200 active:scale-[.98]",
                      marcado
                        ? "bg-grafite text-white"
                        : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    )}
                  >
                    {dia.curto}
                  </button>
                );
              })}
            </div>
            {!horario && dias.length > 1 && (
              <p className="text-[13px] text-neutral-500">
                Vai criar {dias.length} horários iguais, um por dia escolhido.
              </p>
            )}
          </fieldset>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="au-hora" className="text-neutral-700">
                Começa
              </Label>
              <Input
                id="au-hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                disabled={salvando}
                className={CAMPO}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="au-duracao" className="text-neutral-700">
                Minutos
              </Label>
              <Input
                id="au-duracao"
                type="number"
                min={10}
                max={240}
                inputMode="numeric"
                value={duracao}
                onChange={(e) => setDuracao(e.target.value)}
                disabled={salvando}
                className={cn(CAMPO, "numero text-center")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="au-vagas" className="text-neutral-700">
                Vagas
              </Label>
              <Input
                id="au-vagas"
                type="number"
                min={1}
                max={200}
                inputMode="numeric"
                value={vagas}
                onChange={(e) => setVagas(e.target.value)}
                disabled={salvando}
                className={cn(CAMPO, "numero text-center")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="au-local" className="text-neutral-700">
              Local <span className="font-normal text-neutral-400">(opcional)</span>
            </Label>
            <Input
              id="au-local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Sala 2, área externa…"
              disabled={salvando}
              className={CAMPO}
            />
          </div>

          <fieldset className="flex flex-col gap-2.5" disabled={salvando}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">Quem pode marcar</legend>
            <div className="flex gap-2">
              {[
                { texto: "Todos os alunos", valor: true },
                { texto: "Só algumas condições", valor: false },
              ].map(({ texto, valor }) => (
                <button
                  key={texto}
                  type="button"
                  onClick={() => setParaTodos(valor)}
                  aria-pressed={paraTodos === valor}
                  className={cn(
                    "h-11 flex-1 rounded-full text-sm font-medium transition-all duration-200 active:scale-[.98]",
                    paraTodos === valor
                      ? "bg-grafite text-white"
                      : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  {texto}
                </button>
              ))}
            </div>

            {!paraTodos && (
              <div className="mt-1 flex flex-wrap gap-2">
                {AVATAR_OPCOES.map(({ value, label }) => {
                  const marcada = condicoes.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setCondicoes((atuais) =>
                          marcada ? atuais.filter((c) => c !== value) : [...atuais, value]
                        )
                      }
                      aria-pressed={marcada}
                      className={cn(
                        "min-h-10 rounded-full px-3.5 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                        marcada
                          ? "bg-grafite text-white"
                          : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          {erro && (
            <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          <Button type="submit" disabled={salvando} className="h-12 w-full rounded-full text-base font-semibold">
            {salvando ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Salvando...
              </>
            ) : horario ? (
              "Salvar alterações"
            ) : (
              "Criar horário"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
