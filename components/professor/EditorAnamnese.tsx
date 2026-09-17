"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlignLeft,
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Gauge,
  Hash,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  ToggleLeft,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";

import { CampoAnamnese } from "@/components/shared/CampoAnamnese";
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
import {
  agruparPorSecao,
  TEM_OPCOES,
  TIPOS_PERGUNTA,
  type PerguntaAnamnese,
  type Resposta,
  type TipoPergunta,
} from "@/lib/utils/anamnese";

const TITULO_SECAO = "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";
const CARD_LISTA =
  "divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90";
const BOTAO_ICONE =
  "flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-500 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-100 hover:text-neutral-950 active:scale-[.96] disabled:pointer-events-none disabled:opacity-30";
const CHIP = "rounded-full px-2.5 py-0.5 text-[11px] font-semibold";

const ICONE_TIPO: Record<TipoPergunta, LucideIcon> = {
  texto_curto: Type,
  texto_longo: AlignLeft,
  escolha_unica: CircleDot,
  multipla_escolha: ListChecks,
  sim_nao: ToggleLeft,
  numero: Hash,
  escala: Gauge,
  data: CalendarDays,
};

type Rascunho = Pick<
  PerguntaAnamnese,
  "secao" | "enunciado" | "ajuda" | "tipo" | "opcoes" | "obrigatoria" | "no_relatorio"
>;

interface EditorAnamneseProps {
  /** Todas, inclusive as arquivadas. */
  perguntas: PerguntaAnamnese[];
  /** A migração 011 está no banco. Sem ela, a lista é a do código e só dá para ler. */
  editavel: boolean;
}

export function EditorAnamnese({ perguntas, editavel }: EditorAnamneseProps) {
  const router = useRouter();
  const [atualizando, iniciarTransicao] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<PerguntaAnamnese | "nova" | null>(null);
  const [renomeando, setRenomeando] = useState<string | null>(null);

  const ativas = perguntas.filter((p) => p.ativa).sort((a, b) => a.ordem - b.ordem);
  const arquivadas = perguntas.filter((p) => !p.ativa);
  const secoes = agruparPorSecao(ativas);
  const travado = !editavel || ocupado || atualizando;

  async function executar(acao: () => Promise<{ error: unknown } | void>) {
    setErro(null);
    setOcupado(true);
    const resultado = await acao();
    setOcupado(false);

    if (resultado && resultado.error) {
      setErro("Não conseguimos salvar. Confira a conexão e tente de novo.");
      return false;
    }

    iniciarTransicao(() => router.refresh());
    return true;
  }

  /** Grava a ordem de 10 em 10, tocando só nas linhas que mudaram. */
  async function gravarOrdem(lista: PerguntaAnamnese[]) {
    const supabase = createClient();
    const mudancas = lista
      .map((p, i) => ({ id: p.id, ordem: (i + 1) * 10, antes: p.ordem }))
      .filter((p) => p.ordem !== p.antes);

    const resultados = await Promise.all(
      mudancas.map(({ id, ordem }) =>
        supabase.from("anamnese_perguntas").update({ ordem }).eq("id", id)
      )
    );

    return { error: resultados.find((r) => r.error)?.error ?? null };
  }

  function moverPergunta(pergunta: PerguntaAnamnese, direcao: -1 | 1) {
    const daSecao = secoes.find((s) => s.secao === pergunta.secao)!.perguntas;
    const i = daSecao.indexOf(pergunta);
    const vizinha = daSecao[i + direcao];
    if (!vizinha) return;

    const lista = [...ativas];
    const a = lista.indexOf(pergunta);
    const b = lista.indexOf(vizinha);
    [lista[a], lista[b]] = [lista[b], lista[a]];
    executar(() => gravarOrdem(lista));
  }

  function moverSecao(indice: number, direcao: -1 | 1) {
    const grupos = [...secoes];
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= grupos.length) return;
    [grupos[indice], grupos[alvo]] = [grupos[alvo], grupos[indice]];
    executar(() => gravarOrdem(grupos.flatMap((g) => g.perguntas)));
  }

  function alternarArquivo(pergunta: PerguntaAnamnese) {
    executar(async () => {
      const supabase = createClient();
      // Restaurada volta para o fim da própria seção (ou do formulário).
      const ordem = pergunta.ativa
        ? pergunta.ordem
        : Math.max(0, ...ativas.map((p) => p.ordem)) + 10;

      const { error } = await supabase
        .from("anamnese_perguntas")
        .update({ ativa: !pergunta.ativa, ordem, updated_at: new Date().toISOString() })
        .eq("id", pergunta.id);

      if (error || pergunta.ativa) return { error };
      return gravarOrdem(posicionar(ativas, { ...pergunta, ativa: true, ordem }));
    });
  }

  async function salvarPergunta(rascunho: Rascunho) {
    const dados = {
      ...rascunho,
      secao: rascunho.secao.trim(),
      enunciado: rascunho.enunciado.trim(),
      ajuda: rascunho.ajuda?.trim() || null,
      opcoes: TEM_OPCOES.includes(rascunho.tipo)
        ? rascunho.opcoes.map((o) => o.trim()).filter(Boolean)
        : [],
      updated_at: new Date().toISOString(),
    };

    return executar(async () => {
      const supabase = createClient();

      if (editando === "nova") {
        const { data, error } = await supabase
          .from("anamnese_perguntas")
          .insert({ ...dados, ordem: Math.max(0, ...ativas.map((p) => p.ordem)) + 10 })
          .select("*")
          .single();

        if (error || !data) return { error: error ?? "sem retorno" };
        return gravarOrdem(posicionar(ativas, data as PerguntaAnamnese));
      }

      if (!editando) return;

      const { error } = await supabase
        .from("anamnese_perguntas")
        .update(dados)
        .eq("id", editando.id);

      // Mudou de seção: vai para o fim da nova.
      if (error || dados.secao === editando.secao) return { error };
      return gravarOrdem(
        posicionar(
          ativas.filter((p) => p.id !== editando.id),
          { ...editando, ...dados }
        )
      );
    });
  }

  async function renomearSecao(antigo: string, novo: string) {
    const ok = await executar(async () =>
      createClient()
        .from("anamnese_perguntas")
        .update({ secao: novo.trim(), updated_at: new Date().toISOString() })
        .eq("secao", antigo)
    );
    if (ok) setRenomeando(null);
  }

  return (
    <div className="flex flex-col gap-7">
      {!editavel && (
        <div className="flex items-start gap-3 rounded-2xl bg-saude-amarelo-light px-5 py-4 text-sm leading-relaxed text-neutral-800">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-saude-amarelo" strokeWidth={1.8} aria-hidden />
          <p>
            O editor está sendo ativado. Enquanto isso, o formulário segue com as perguntas de
            sempre, que aparecem abaixo só para leitura.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => setEditando("nova")}
          disabled={travado}
          className="h-11 rounded-full px-5 font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          Nova pergunta
        </Button>
        <span className="rotulo text-neutral-400">
          {ativas.length} {ativas.length === 1 ? "pergunta" : "perguntas"} · {secoes.length}{" "}
          {secoes.length === 1 ? "parte" : "partes"}
        </span>
        {(ocupado || atualizando) && (
          <Loader2 className="size-4 animate-spin text-neutral-400" aria-label="Salvando" />
        )}
      </div>

      {erro && (
        <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      {secoes.map(({ secao, perguntas: daSecao }, indiceSecao) => (
        <section key={secao} className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="rotulo text-neutral-400">
                Parte {indiceSecao + 1} de {secoes.length}
              </p>
              <h2 className={cn(TITULO_SECAO, "mt-1 truncate")}>{secao}</h2>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => moverSecao(indiceSecao, -1)}
                disabled={travado || indiceSecao === 0}
                aria-label={`Subir a parte ${secao}`}
                className={BOTAO_ICONE}
              >
                <ChevronUp className="size-4" strokeWidth={1.9} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => moverSecao(indiceSecao, 1)}
                disabled={travado || indiceSecao === secoes.length - 1}
                aria-label={`Descer a parte ${secao}`}
                className={BOTAO_ICONE}
              >
                <ChevronDown className="size-4" strokeWidth={1.9} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setRenomeando(secao)}
                disabled={travado}
                aria-label={`Renomear a parte ${secao}`}
                className={BOTAO_ICONE}
              >
                <Pencil className="size-4" strokeWidth={1.9} aria-hidden />
              </button>
            </div>
          </div>

          <ul className={CARD_LISTA}>
            {daSecao.map((pergunta, i) => {
              const Icone = ICONE_TIPO[pergunta.tipo];

              return (
                <li key={pergunta.id} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => moverPergunta(pergunta, -1)}
                      disabled={travado || i === 0}
                      aria-label={`Subir "${pergunta.enunciado}"`}
                      className="flex size-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950 disabled:pointer-events-none disabled:opacity-25"
                    >
                      <ChevronUp className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverPergunta(pergunta, 1)}
                      disabled={travado || i === daSecao.length - 1}
                      aria-label={`Descer "${pergunta.enunciado}"`}
                      className="flex size-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950 disabled:pointer-events-none disabled:opacity-25"
                    >
                      <ChevronDown className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-snug font-semibold text-neutral-950">
                      {pergunta.enunciado}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn(CHIP, "flex items-center gap-1 bg-neutral-100 text-neutral-600")}>
                        <Icone className="size-3" strokeWidth={2} aria-hidden />
                        {TIPOS_PERGUNTA[pergunta.tipo].nome}
                        {TEM_OPCOES.includes(pergunta.tipo) && ` · ${pergunta.opcoes.length} opções`}
                      </span>
                      {pergunta.obrigatoria && (
                        <span className={cn(CHIP, "bg-saude-vermelho-light text-saude-vermelho")}>
                          Obrigatória
                        </span>
                      )}
                      {pergunta.no_relatorio && (
                        <span className={cn(CHIP, "bg-neutral-100 text-neutral-600")}>
                          Vai ao médico
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditando(pergunta)}
                    disabled={travado}
                    aria-label={`Editar "${pergunta.enunciado}"`}
                    className={BOTAO_ICONE}
                  >
                    <Pencil className="size-4" strokeWidth={1.9} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => alternarArquivo(pergunta)}
                    disabled={travado || (ativas.length === 1)}
                    aria-label={`Arquivar "${pergunta.enunciado}"`}
                    className={cn(BOTAO_ICONE, "hover:bg-saude-vermelho-light hover:text-saude-vermelho")}
                  >
                    <Archive className="size-4" strokeWidth={1.9} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {arquivadas.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <div>
            <h2 className={TITULO_SECAO}>Arquivadas</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
              Saem do formulário, mas o que os alunos já responderam continua na ficha.
            </p>
          </div>
          <ul className={CARD_LISTA}>
            {arquivadas.map((pergunta) => (
              <li key={pergunta.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-600">{pergunta.enunciado}</p>
                  <p className="rotulo mt-0.5 text-neutral-400">{pergunta.secao}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => alternarArquivo(pergunta)}
                  disabled={travado}
                  className="h-10 rounded-full px-4 font-semibold"
                >
                  <ArchiveRestore className="size-4" aria-hidden />
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editando && (
        <DialogPergunta
          key={editando === "nova" ? "nova" : editando.id}
          pergunta={editando === "nova" ? null : editando}
          secoes={secoes.map((s) => s.secao)}
          salvando={ocupado}
          erro={erro}
          onFechar={() => {
            setEditando(null);
            setErro(null);
          }}
          onSalvar={async (rascunho) => {
            if (await salvarPergunta(rascunho)) setEditando(null);
          }}
        />
      )}

      {renomeando !== null && (
        <DialogRenomear
          key={renomeando}
          atual={renomeando}
          salvando={ocupado}
          onFechar={() => setRenomeando(null)}
          onSalvar={(novo) => renomearSecao(renomeando, novo)}
        />
      )}
    </div>
  );
}

/** Coloca a pergunta no fim da seção dela; seção nova vai para o fim do formulário. */
function posicionar(ativas: PerguntaAnamnese[], pergunta: PerguntaAnamnese) {
  const lista = ativas.filter((p) => p.id !== pergunta.id);
  const ultima = lista.map((p) => p.secao).lastIndexOf(pergunta.secao);
  lista.splice(ultima === -1 ? lista.length : ultima + 1, 0, pergunta);
  return lista;
}

function DialogPergunta({
  pergunta,
  secoes,
  salvando,
  erro,
  onFechar,
  onSalvar,
}: {
  pergunta: PerguntaAnamnese | null;
  secoes: string[];
  salvando: boolean;
  erro: string | null;
  onFechar: () => void;
  onSalvar: (rascunho: Rascunho) => void;
}) {
  const [rascunho, setRascunho] = useState<Rascunho>(() => ({
    secao: pergunta?.secao ?? secoes[secoes.length - 1] ?? "",
    enunciado: pergunta?.enunciado ?? "",
    ajuda: pergunta?.ajuda ?? "",
    tipo: pergunta?.tipo ?? "texto_curto",
    opcoes: pergunta?.opcoes.length ? pergunta.opcoes : ["", ""],
    obrigatoria: pergunta?.obrigatoria ?? false,
    no_relatorio: pergunta?.no_relatorio ?? false,
  }));
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Resposta | null>(null);

  const temOpcoes = TEM_OPCOES.includes(rascunho.tipo);
  const mudar = (parcial: Partial<Rascunho>) => setRascunho((r) => ({ ...r, ...parcial }));

  function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAviso(null);

    if (!rascunho.enunciado.trim()) return setAviso("Escreva a pergunta.");
    if (!rascunho.secao.trim()) return setAviso("Diga em qual parte do formulário ela entra.");

    if (temOpcoes) {
      const opcoes = rascunho.opcoes.map((o) => o.trim()).filter(Boolean);
      if (opcoes.length < 2) return setAviso("Escolha precisa de pelo menos duas opções.");
      if (new Set(opcoes).size !== opcoes.length) return setAviso("Há opções repetidas.");
    }

    onSalvar(rascunho);
  }

  return (
    <Dialog open onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{pergunta ? "Editar pergunta" : "Nova pergunta"}</DialogTitle>
            <DialogDescription>
              {pergunta
                ? "A mudança vale para todos os alunos. O que já foi respondido fica guardado."
                : "Entra no formulário de todos os alunos, inclusive de quem já respondeu."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pa-enunciado" className="text-neutral-700">
              Pergunta
            </Label>
            <Input
              id="pa-enunciado"
              value={rascunho.enunciado}
              onChange={(e) => mudar({ enunciado: e.target.value })}
              placeholder="Você sente dor em alguma articulação?"
              disabled={salvando}
              autoFocus={!pergunta}
              className="h-12 rounded-[14px] px-4 text-base"
            />
          </div>

          <fieldset className="flex flex-col gap-2.5" disabled={salvando}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">Tipo de resposta</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(TIPOS_PERGUNTA) as TipoPergunta[]).map((tipo) => {
                const Icone = ICONE_TIPO[tipo];
                const marcado = rascunho.tipo === tipo;

                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      mudar({ tipo });
                      setPrevia(null);
                    }}
                    aria-pressed={marcado}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-[14px] px-3 py-2.5 text-left transition-all duration-200 active:scale-[.98]",
                      marcado
                        ? "bg-grafite text-white"
                        : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    )}
                  >
                    <Icone
                      className={cn("size-4", marcado ? "text-ciano" : "text-neutral-400")}
                      strokeWidth={1.9}
                      aria-hidden
                    />
                    <span className="text-[13px] leading-tight font-semibold">
                      {TIPOS_PERGUNTA[tipo].nome}
                    </span>
                    <span className={cn("text-[11px] leading-tight", marcado ? "text-white/60" : "text-neutral-400")}>
                      {TIPOS_PERGUNTA[tipo].descricao}
                    </span>
                  </button>
                );
              })}
            </div>
            {pergunta && pergunta.tipo !== rascunho.tipo && (
              <p className="text-[13px] leading-relaxed text-neutral-500">
                Quem já respondeu não perde nada: o que der para aproveitar no novo tipo aparece
                preenchido.
              </p>
            )}
          </fieldset>

          {temOpcoes && (
            <fieldset className="flex flex-col gap-2" disabled={salvando}>
              <legend className="mb-2 text-sm font-medium text-neutral-700">Opções</legend>
              {rascunho.opcoes.map((opcao, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opcao}
                    onChange={(e) =>
                      mudar({ opcoes: rascunho.opcoes.map((o, j) => (j === i ? e.target.value : o)) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (i === rascunho.opcoes.length - 1) mudar({ opcoes: [...rascunho.opcoes, ""] });
                      }
                    }}
                    placeholder={`Opção ${i + 1}`}
                    aria-label={`Opção ${i + 1}`}
                    autoFocus={i > 1 && i === rascunho.opcoes.length - 1 && !opcao}
                    className="h-11 rounded-[14px] px-4 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => mudar({ opcoes: rascunho.opcoes.filter((_, j) => j !== i) })}
                    disabled={rascunho.opcoes.length <= 2}
                    aria-label={`Remover opção ${i + 1}`}
                    className={BOTAO_ICONE}
                  >
                    <X className="size-4" strokeWidth={1.9} aria-hidden />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => mudar({ opcoes: [...rascunho.opcoes, ""] })}
                className="mt-1 flex w-fit items-center gap-1.5 text-sm font-semibold text-primary"
              >
                <Plus className="size-4" aria-hidden />
                Adicionar opção
              </button>
              {pergunta && (
                <p className="text-[13px] leading-relaxed text-neutral-500">
                  Renomear uma opção não muda o que já foi respondido com o nome antigo.
                </p>
              )}
            </fieldset>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="pa-ajuda" className="text-neutral-700">
              {["texto_curto", "texto_longo", "numero"].includes(rascunho.tipo)
                ? "Exemplo dentro do campo"
                : "Explicação embaixo da pergunta"}{" "}
              <span className="font-normal text-neutral-400">(opcional)</span>
            </Label>
            <Input
              id="pa-ajuda"
              value={rascunho.ajuda ?? ""}
              onChange={(e) => mudar({ ajuda: e.target.value })}
              placeholder={rascunho.tipo === "escala" ? "0 é nenhuma dor, 10 é a pior dor" : "Joelho, ombro, lombar…"}
              disabled={salvando}
              className="h-12 rounded-[14px] px-4 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pa-secao" className="text-neutral-700">
              Parte do formulário
            </Label>
            <Input
              id="pa-secao"
              list="pa-secoes"
              value={rascunho.secao}
              onChange={(e) => mudar({ secao: e.target.value })}
              placeholder="Escolha uma ou escreva o nome de uma nova"
              disabled={salvando}
              className="h-12 rounded-[14px] px-4 text-base"
            />
            <datalist id="pa-secoes">
              {secoes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-2">
            <Interruptor
              rotulo="Obrigatória"
              descricao="O aluno não consegue enviar sem responder."
              ligado={rascunho.obrigatoria}
              onMudar={(obrigatoria) => mudar({ obrigatoria })}
              desabilitado={salvando}
            />
            <Interruptor
              rotulo="Vai no relatório do médico"
              descricao="Aparece na folha mensal que o aluno imprime."
              ligado={rascunho.no_relatorio}
              onMudar={(no_relatorio) => mudar({ no_relatorio })}
              desabilitado={salvando}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-background p-4">
            <p className="rotulo text-neutral-400">Como o aluno vê</p>
            <CampoAnamnese
              pergunta={{ id: "previa", ...rascunho }}
              valor={previa}
              onMudar={setPrevia}
            />
          </div>

          {(aviso || erro) && (
            <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {aviso ?? erro}
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
                Salvando...
              </>
            ) : pergunta ? (
              "Salvar alterações"
            ) : (
              "Adicionar pergunta"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Interruptor({
  rotulo,
  descricao,
  ligado,
  onMudar,
  desabilitado,
}: {
  rotulo: string;
  descricao: string;
  ligado: boolean;
  onMudar: (ligado: boolean) => void;
  desabilitado: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onMudar(!ligado)}
      disabled={desabilitado}
      className="flex items-center justify-between gap-4 rounded-[14px] px-1 py-2 text-left disabled:opacity-60"
    >
      <span>
        <span className="block text-sm font-medium text-neutral-800">{rotulo}</span>
        <span className="block text-[13px] text-neutral-500">{descricao}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
          ligado ? "bg-primary" : "bg-neutral-200"
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all duration-200",
            ligado ? "left-6" : "left-1"
          )}
        />
      </span>
    </button>
  );
}

function DialogRenomear({
  atual,
  salvando,
  onFechar,
  onSalvar,
}: {
  atual: string;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (novo: string) => void;
}) {
  const [nome, setNome] = useState(atual);

  return (
    <Dialog open onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim() && nome.trim() !== atual) onSalvar(nome);
            else onFechar();
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <DialogHeader>
            <DialogTitle>Renomear parte</DialogTitle>
            <DialogDescription>
              Todas as perguntas desta parte passam para o novo nome.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-label="Nome da parte"
            autoFocus
            disabled={salvando}
            className="h-12 rounded-[14px] px-4 text-base"
          />
          <Button type="submit" disabled={salvando} className="h-12 rounded-full text-base font-semibold">
            {salvando ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
