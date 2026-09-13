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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setCriandoEvento(true)}
          className="h-11 rounded-xl px-4 font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          Novo evento
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCriandoAviso(true)}
          className="h-11 rounded-xl px-4 font-semibold"
        >
          <Bell className="size-5" aria-hidden />
          Enviar comunicado
        </Button>
      </div>

      {/* ── Eventos ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Próximos
        </h2>

        {proximos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-neutral-500">
              Nenhum evento marcado. Crie um e os alunos confirmam presença no
              app.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {proximos.map((evento) => (
              <li
                key={evento.id}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="text-xs leading-none font-medium uppercase">
                    {format(new Date(evento.dataInicio), "MMM", {
                      locale: ptBR,
                    })}
                  </span>
                  <span className="text-base leading-tight font-bold">
                    {format(new Date(evento.dataInicio), "dd")}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">
                    {evento.titulo}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {format(new Date(evento.dataInicio), "dd/MM 'às' HH:mm")}
                    {" · "}
                    {evento.paraTodos
                      ? "todos os alunos"
                      : `${evento.condicoes.length} condições`}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-neutral-600">
                    <Users className="size-3.5" aria-hidden />
                    {evento.totalConfirmados}{" "}
                    {evento.totalConfirmados === 1
                      ? "confirmado"
                      : "confirmados"}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => excluirEvento(evento.id)}
                  aria-label={`Excluir ${evento.titulo}`}
                  className="text-saude-vermelho"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {passados.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Já aconteceram
          </h2>
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {passados.slice(0, 10).map((evento) => (
              <li key={evento.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-600">
                    {evento.titulo}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {format(new Date(evento.dataInicio), "dd/MM/yyyy")} ·{" "}
                    {evento.totalConfirmados} confirmaram
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Comunicados ────────────────────────────────────────────── */}
      {notificacoes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Comunicados enviados
          </h2>
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {notificacoes.map((aviso) => (
              <li key={aviso.id} className="flex flex-col gap-0.5 p-3.5">
                <p className="text-sm font-medium text-neutral-900">
                  {aviso.titulo}
                </p>
                <p className="text-sm text-neutral-600">{aviso.corpo}</p>
                <p className="text-xs text-neutral-400">
                  {format(new Date(aviso.created_at), "dd/MM 'às' HH:mm")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

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

    if (error) return setErro("Não conseguimos criar o evento.");

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
              className="h-12 rounded-xl px-3.5 text-base"
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
              className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                className="h-12 rounded-xl px-3 text-sm"
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
                className="h-12 rounded-xl px-3 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3.5 py-3">
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
            <fieldset className="flex flex-wrap gap-2" disabled={salvando}>
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
                      "rounded-xl border px-3 py-2 text-sm transition-colors",
                      marcada
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-neutral-200 bg-white text-neutral-600"
                    )}
                  >
                    {opcao.label}
                  </button>
                );
              })}
            </fieldset>
          )}

          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-saude-vermelho-light px-3.5 py-3 text-sm text-saude-vermelho"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={salvando}
            className="h-12 w-full rounded-xl text-base font-semibold"
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

    if (error) return setErro("Não conseguimos enviar.");

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
            className="h-12 rounded-xl px-3.5 text-base"
          />

          <textarea
            rows={4}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Escreva o aviso para os alunos."
            aria-label="Mensagem do comunicado"
            disabled={salvando}
            className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          />

          {erro && (
            <p role="alert" className="text-sm text-saude-vermelho">
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={salvando}
            className="h-12 w-full rounded-xl text-base font-semibold"
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
