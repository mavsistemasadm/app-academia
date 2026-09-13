"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
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
import type { AvatarCondicao, Notificacao } from "@/lib/types";
import type { EventoNaAgenda } from "@/lib/supabase/agenda";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_OPCOES } from "@/lib/utils/avatares";
import { naAcademia } from "@/lib/utils/datas";

const TEXTAREA =
  "w-full resize-none rounded-[14px] border border-input bg-card px-3.5 py-3 text-base transition-colors outline-none placeholder:text-neutral-400 hover:border-neutral-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";
const TITULO_SECAO = "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";
const CARD_LISTA =
  "divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90";

interface GerenciarAgendaProps {
  professorId: string;
  eventos: EventoNaAgenda[];
  notificacoes: Notificacao[];
}

export function GerenciarAgenda({
  professorId,
  eventos,
  notificacoes,
}: GerenciarAgendaProps) {
  const router = useRouter();
  const [criandoEvento, setCriandoEvento] = useState(false);
  const [criandoAviso, setCriandoAviso] = useState(false);
  const [, iniciarTransicao] = useTransition();

  async function excluirEvento(id: string) {
    await createClient().from("eventos").delete().eq("id", id);
    iniciarTransicao(() => router.refresh());
  }

  const agora = new Date().toISOString();
  const proximos = eventos.filter((e) => (e.dataFim ?? e.dataInicio) >= agora);
  const passados = eventos.filter((e) => (e.dataFim ?? e.dataInicio) < agora);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setCriandoEvento(true)}
          className="h-11 rounded-full px-5 font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          Novo evento
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCriandoAviso(true)}
          className="h-11 rounded-full px-5 font-semibold"
        >
          <Bell className="size-4" aria-hidden />
          Enviar comunicado
        </Button>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-7">
          {/* ── Próximos eventos ─────────────────────────────────── */}
          <section className="flex flex-col gap-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className={TITULO_SECAO}>Próximos eventos</h2>
              {proximos.length > 0 && (
                <span className="rotulo text-neutral-400">{proximos.length} marcados</span>
              )}
            </div>

            {proximos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
                <CalendarDays className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
                <p className="text-[15px] font-semibold text-neutral-950">Nenhum evento marcado</p>
                <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
                  Crie um evento e os alunos confirmam presença pelo app.
                </p>
                <button
                  type="button"
                  onClick={() => setCriandoEvento(true)}
                  className="mt-1 text-sm font-semibold text-primary"
                >
                  Criar evento →
                </button>
              </div>
            ) : (
              <ul className={CARD_LISTA}>
                {proximos.map((evento) => (
                  <li key={evento.id} className="flex items-center gap-4 px-4 py-4 md:px-5">
                    <div className="flex w-12 shrink-0 flex-col items-center border-r border-neutral-200/80 pr-4">
                      <span className="rotulo text-primary">
                        {format(naAcademia(evento.dataInicio), "MMM", { locale: ptBR })}
                      </span>
                      <span className="numero text-[26px] leading-none font-semibold text-neutral-950">
                        {format(naAcademia(evento.dataInicio), "dd")}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-neutral-950">{evento.titulo}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="rotulo text-neutral-400">
                          {format(naAcademia(evento.dataInicio), "EEE 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600">
                          {evento.paraTodos
                            ? "Todos os alunos"
                            : `${evento.condicoes.length} ${evento.condicoes.length === 1 ? "condição" : "condições"}`}
                        </span>
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-neutral-500">
                        <Users className="size-3.5 text-neutral-400" strokeWidth={1.8} aria-hidden />
                        <span className="numero font-semibold text-neutral-950">
                          {evento.totalConfirmados}
                        </span>
                        {evento.totalConfirmados === 1 ? "confirmado" : "confirmados"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => excluirEvento(evento.id)}
                      aria-label={`Excluir ${evento.titulo}`}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-400 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-saude-vermelho-light hover:text-saude-vermelho hover:ring-transparent active:scale-[.96]"
                    >
                      <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {passados.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <h2 className={TITULO_SECAO}>Já aconteceram</h2>
              <ul className={CARD_LISTA}>
                {passados.slice(0, 10).map((evento) => (
                  <li key={evento.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                    <p className="min-w-0 flex-1 truncate text-sm text-neutral-600">
                      {evento.titulo}
                    </p>
                    <span className="rotulo shrink-0 text-neutral-400">
                      {format(naAcademia(evento.dataInicio), "dd/MM/yy")}
                    </span>
                    <span className="numero w-16 shrink-0 text-right text-sm font-semibold text-neutral-950">
                      {evento.totalConfirmados}
                      <span className="ml-1 font-sans text-[11px] font-medium tracking-normal text-neutral-400">
                        vieram
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Comunicados ────────────────────────────────────────── */}
        <section className="flex flex-col gap-3.5">
          <h2 className={TITULO_SECAO}>Comunicados enviados</h2>

          {notificacoes.length === 0 ? (
            <div className="flex items-start gap-3 rounded-2xl bg-card px-5 py-5 ring-1 ring-neutral-200/90">
              <Megaphone className="mt-0.5 size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
              <div>
                <p className="text-sm leading-relaxed text-neutral-500">
                  Nenhum comunicado ainda. Avisos de feriado, mudança de horário ou
                  aula especial chegam na agenda de todos os alunos.
                </p>
                <button
                  type="button"
                  onClick={() => setCriandoAviso(true)}
                  className="mt-1.5 text-sm font-semibold text-primary"
                >
                  Escrever comunicado →
                </button>
              </div>
            </div>
          ) : (
            <ul className={CARD_LISTA}>
              {notificacoes.map((aviso) => (
                <li key={aviso.id} className="flex flex-col gap-1 px-4 py-4 md:px-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-semibold text-neutral-950">{aviso.titulo}</p>
                    <span className="rotulo shrink-0 text-neutral-400">
                      {format(naAcademia(aviso.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-500">{aviso.corpo}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <DialogEvento
        professorId={professorId}
        aberto={criandoEvento}
        onFechar={() => setCriandoEvento(false)}
      />
      <DialogComunicado
        professorId={professorId}
        aberto={criandoAviso}
        onFechar={() => setCriandoAviso(false)}
      />
    </div>
  );
}

function DialogEvento({
  professorId,
  aberto,
  onFechar,
}: {
  professorId: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [paraTodos, setParaTodos] = useState(true);
  const [condicoes, setCondicoes] = useState<AvatarCondicao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (titulo.trim().length < 3) return setErro("Dê um título ao evento.");
    if (!inicio) return setErro("Escolha a data e a hora de início.");
    if (!paraTodos && condicoes.length === 0) {
      return setErro("Escolha ao menos uma condição, ou marque 'todos'.");
    }

    setSalvando(true);

    /*
      `datetime-local` entrega o horário local do navegador sem fuso. O
      professor está em São Paulo, então `new Date()` interpreta certo — e
      o toISOString grava em UTC, que é o que a coluna timestamptz espera.
    */
    const { error } = await createClient().from("eventos").insert({
      professor_id: professorId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      data_inicio: new Date(inicio).toISOString(),
      data_fim: fim ? new Date(fim).toISOString() : null,
      para_todos: paraTodos,
      avatar_condicao: paraTodos ? null : condicoes,
    });

    setSalvando(false);

    if (error) return setErro("Não conseguimos criar o evento. Tente de novo.");

    setTitulo("");
    setDescricao("");
    setInicio("");
    setFim("");
    setParaTodos(true);
    setCondicoes([]);
    onFechar();
    router.refresh();
  }

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Novo evento</DialogTitle>
            <DialogDescription>
              Aparece na agenda dos alunos, que podem confirmar presença.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ev-titulo" className="text-neutral-700">
              Título
            </Label>
            <Input
              id="ev-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Aula de alongamento para 60+"
              disabled={salvando}
              className="h-12 px-3.5 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ev-descricao" className="text-neutral-700">
              Descrição{" "}
              <span className="font-normal text-neutral-400">(opcional)</span>
            </Label>
            <textarea
              id="ev-descricao"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={salvando}
              className={TEXTAREA}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ev-inicio" className="text-neutral-700">
                Início
              </Label>
              <Input
                id="ev-inicio"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                disabled={salvando}
                className="h-12 px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ev-fim" className="text-neutral-700">
                Fim{" "}
                <span className="font-normal text-neutral-400">(opcional)</span>
              </Label>
              <Input
                id="ev-fim"
                type="datetime-local"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                disabled={salvando}
                className="h-12 px-3 text-sm"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-[14px] px-4 py-3 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50">
            <input
              type="checkbox"
              checked={paraTodos}
              onChange={(e) => setParaTodos(e.target.checked)}
              disabled={salvando}
              className="size-5 accent-primary"
            />
            <span className="text-sm text-neutral-700">
              Para todos os alunos
            </span>
          </label>

          {!paraTodos && (
            <fieldset className="flex flex-wrap gap-1.5" disabled={salvando}>
              <legend className="mb-2 w-full text-sm leading-none font-medium text-neutral-700">
                Só para estas condições
              </legend>
              {AVATAR_OPCOES.map((opcao) => {
                const marcada = condicoes.includes(opcao.value);

                return (
                  <button
                    key={opcao.value}
                    type="button"
                    onClick={() =>
                      setCondicoes((atuais) =>
                        marcada
                          ? atuais.filter((c) => c !== opcao.value)
                          : [...atuais, opcao.value]
                      )
                    }
                    aria-pressed={marcada}
                    className={cn(
                      "h-9 rounded-full px-3.5 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                      marcada
                        ? "bg-grafite text-white"
                        : "bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    )}
                  >
                    {opcao.label}
                  </button>
                );
              })}
            </fieldset>
          )}

          {erro && (
            <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={salvando}
            className="h-12 w-full rounded-full text-base font-semibold"
          >
            {salvando ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Criando...
              </>
            ) : (
              "Criar evento"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogComunicado({
  professorId,
  aberto,
  onFechar,
}: {
  professorId: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();

  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (titulo.trim().length < 3 || corpo.trim().length < 3) {
      return setErro("Preencha título e mensagem.");
    }

    setSalvando(true);

    const { error } = await createClient().from("notificacoes").insert({
      professor_id: professorId,
      titulo: titulo.trim(),
      corpo: corpo.trim(),
      para_todos: true,
    });

    setSalvando(false);

    if (error) return setErro("Não conseguimos enviar. Tente de novo.");

    setTitulo("");
    setCorpo("");
    onFechar();
    router.refresh();
  }

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Comunicado</DialogTitle>
            <DialogDescription>
              Aparece na agenda de todos os alunos.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título"
            aria-label="Título do comunicado"
            disabled={salvando}
            className="h-12 px-3.5 text-base"
          />

          <textarea
            rows={4}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Escreva o aviso para os alunos."
            aria-label="Mensagem do comunicado"
            disabled={salvando}
            className={TEXTAREA}
          />

          {erro && (
            <p role="alert" className="text-sm text-saude-vermelho">
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={salvando}
            className="h-12 w-full rounded-full text-base font-semibold"
          >
            {salvando ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Enviando...
              </>
            ) : (
              "Enviar comunicado"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
