"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowRight,
  FileText,
  ImagePlus,
  Loader2,
  Paperclip,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  Trophy,
  Users,
  X,
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
import type { DesafioDoProfessor } from "@/lib/supabase/desafios";
import {
  formatarQuantidade,
  HABITOS,
  MODELOS,
  METRICAS,
  REGRAS_PADRAO,
  ROTULO_SITUACAO,
  type Metrica,
  type ModeloDesafio,
  type Regras,
  type TipoDesafio,
} from "@/lib/utils/desafios";

const TITULO_SECAO = "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";
const CARD_LISTA =
  "divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90";
const CHIP = "rounded-full px-2.5 py-0.5 text-[11px] font-semibold";
const CAMPO = "h-12 rounded-[14px] px-4 text-base";

export interface AlunoSimples {
  id: string;
  nome: string;
}

interface GerenciarDesafiosProps {
  professorId: string;
  desafios: DesafioDoProfessor[];
  alunos: AlunoSimples[];
  /** Quem está em cada desafio: `{ [desafioId]: alunoId[] }`. */
  participantesPorDesafio: Record<string, string[]>;
  indisponivel: boolean;
}

function dataCurta(iso: string) {
  return format(new Date(`${iso}T12:00:00Z`), "d 'de' MMM", { locale: ptBR });
}

export function GerenciarDesafios({
  professorId,
  desafios,
  alunos,
  participantesPorDesafio,
  indisponivel,
}: GerenciarDesafiosProps) {
  const router = useRouter();
  const [editando, setEditando] = useState<DesafioDoProfessor | "novo" | null>(null);
  const [modelo, setModelo] = useState<ModeloDesafio | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  async function alternarCancelado(desafio: DesafioDoProfessor) {
    setErro(null);
    setOcupado(true);

    const { error } = await createClient()
      .from("desafios")
      .update({ cancelado: !desafio.desafio.cancelado, updated_at: new Date().toISOString() })
      .eq("id", desafio.desafio.id);

    setOcupado(false);

    if (error) {
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }
    iniciarTransicao(() => router.refresh());
  }

  const noAr = desafios.filter((d) => !d.desafio.cancelado);
  const cancelados = desafios.filter((d) => d.desafio.cancelado);

  return (
    <div className="flex flex-col gap-7">
      {indisponivel && (
        <div className="flex items-start gap-3 rounded-2xl bg-saude-amarelo-light px-5 py-4 text-sm leading-relaxed text-neutral-800">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-saude-amarelo" strokeWidth={1.8} aria-hidden />
          <p>Os desafios estão sendo ativados no banco. Volte daqui a pouco.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            setModelo(null);
            setEditando("novo");
          }}
          disabled={indisponivel || ocupado}
          className="h-11 rounded-full px-5 font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          Novo desafio
        </Button>
        {ocupado && <Loader2 className="size-4 animate-spin text-neutral-400" aria-label="Salvando" />}
      </div>

      {erro && (
        <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      <section className="flex flex-col gap-3.5">
        <div>
          <h2 className={TITULO_SECAO}>Modelos prontos</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
            Escolha um e o formulário abre preenchido. Dá para mudar tudo antes de salvar, e você
            pode ter vários desafios no ar ao mesmo tempo.
          </p>
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {MODELOS.map((m) => (
            <li key={m.chave}>
              <button
                type="button"
                disabled={indisponivel || ocupado}
                onClick={() => {
                  setModelo(m);
                  setEditando("novo");
                }}
                className="flex h-full w-full flex-col items-start gap-1 rounded-2xl bg-card px-4 py-3.5 text-left ring-1 ring-neutral-200/90 transition-all duration-200 hover:bg-neutral-50 active:scale-[.99] disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  {m.tipo === "meta" ? (
                    <Target className="size-4 text-neutral-400" strokeWidth={1.9} aria-hidden />
                  ) : (
                    <Trophy className="size-4 text-neutral-400" strokeWidth={1.9} aria-hidden />
                  )}
                  <span className="text-[15px] font-semibold text-neutral-950">{m.nome}</span>
                </span>
                <span className="text-[13px] leading-relaxed text-neutral-500">{m.descricao}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {noAr.length === 0 && !indisponivel && (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-neutral-200/90">
          <Trophy className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
          <p className="text-[15px] font-semibold text-neutral-950">Nenhum desafio criado</p>
          <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
            Um desafio dura um período e pontua o que o aluno já faz no app: aparecer, treinar,
            medir, beber água e tomar o medicamento na hora.
          </p>
        </div>
      )}

      {[
        { titulo: "Desafios", itens: noAr },
        { titulo: "Cancelados", itens: cancelados },
      ]
        .filter(({ itens }) => itens.length > 0)
        .map(({ titulo, itens }) => (
          <section key={titulo} className="flex flex-col gap-3.5">
            <h2 className={TITULO_SECAO}>{titulo}</h2>

            <ul className={CARD_LISTA}>
              {itens.map((item) => {
                const { desafio, situacao, participantes, convidados } = item;

                return (
                  <li key={desafio.id} className="flex flex-col gap-3 px-4 py-4 md:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-[15px] font-semibold text-neutral-950">{desafio.nome}</p>
                          <span
                            className={cn(
                              CHIP,
                              situacao === "em_andamento"
                                ? "bg-saude-verde-light text-[#15803d]"
                                : "bg-neutral-100 text-neutral-600"
                            )}
                          >
                            {ROTULO_SITUACAO[situacao]}
                          </span>
                          <span className={cn(CHIP, "bg-neutral-100 text-neutral-600")}>
                            {desafio.aberto ? "Aberto a todos" : "Só convidados"}
                          </span>
                          {desafio.tipo === "meta" && desafio.metrica && desafio.objetivo && (
                            <span className={cn(CHIP, "bg-neutral-100 text-neutral-600")}>
                              Meta de {formatarQuantidade(desafio.objetivo, desafio.metrica)}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-[13px] text-neutral-500">
                          {dataCurta(desafio.inicio)} a {dataCurta(desafio.fim)}
                        </p>

                        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-neutral-500">
                          <Users className="size-3.5 text-neutral-400" strokeWidth={1.8} aria-hidden />
                          <span className="numero font-semibold text-neutral-950">{participantes}</span>
                          {participantes === 1 ? "participando" : "participando"}
                          {convidados > 0 && <> · {convidados} sem responder</>}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => alternarCancelado(item)}
                        disabled={ocupado}
                        aria-label={desafio.cancelado ? "Reativar desafio" : "Cancelar desafio"}
                        title={desafio.cancelado ? "Reativar" : "Cancelar"}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-400 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-saude-vermelho-light hover:text-saude-vermelho hover:ring-transparent active:scale-[.96]"
                      >
                        {desafio.cancelado ? (
                          <RotateCcw className="size-4" strokeWidth={1.9} aria-hidden />
                        ) : (
                          <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditando(item)}
                        className="h-10 rounded-full px-4 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:text-neutral-950"
                      >
                        Editar e convidar
                      </button>
                      <Link
                        href={`/desafios/${desafio.id}`}
                        className="flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary"
                      >
                        Ver ranking
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      {editando && (
        <DialogDesafio
          key={editando === "novo" ? (modelo?.chave ?? "novo") : editando.desafio.id}
          professorId={professorId}
          item={editando === "novo" ? null : editando}
          modelo={editando === "novo" ? modelo : null}
          alunos={alunos}
          participantes={
            editando === "novo" ? [] : (participantesPorDesafio[editando.desafio.id] ?? [])
          }
          onFechar={() => {
            setEditando(null);
            setModelo(null);
          }}
          onPronto={() => {
            setEditando(null);
            setModelo(null);
            iniciarTransicao(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

function DialogDesafio({
  professorId,
  item,
  modelo,
  alunos,
  participantes,
  onFechar,
  onPronto,
}: {
  professorId: string;
  item: DesafioDoProfessor | null;
  /** Modelo pronto escolhido na lista: preenche o formulário. */
  modelo: ModeloDesafio | null;
  alunos: AlunoSimples[];
  participantes: string[];
  onFechar: () => void;
  onPronto: () => void;
}) {
  // Dentro do useState: a data de hoje só vale na abertura do diálogo, e
  // lê-la no corpo do componente tornaria o render impuro.
  const [nome, setNome] = useState(item?.desafio.nome ?? modelo?.nome ?? "");
  const [descricao, setDescricao] = useState(item?.desafio.descricao ?? modelo?.descricao ?? "");
  const [inicio, setInicio] = useState(
    () => item?.desafio.inicio ?? new Date().toISOString().slice(0, 10)
  );
  const [fim, setFim] = useState(
    () =>
      item?.desafio.fim ??
      new Date(Date.now() + (modelo?.dias ?? 30) * 86400000).toISOString().slice(0, 10)
  );
  const [aberto, setAberto] = useState(item?.desafio.aberto ?? true);
  const [tipo, setTipo] = useState<TipoDesafio>(item?.desafio.tipo ?? modelo?.tipo ?? "pontos");
  const [metrica, setMetrica] = useState<Metrica>(item?.desafio.metrica ?? modelo?.metrica ?? "km");
  const [objetivo, setObjetivo] = useState(
    String(item?.desafio.objetivo ?? modelo?.objetivo ?? 5).replace(".", ",")
  );
  const [imagemUrl, setImagemUrl] = useState(item?.desafio.imagemUrl ?? null);
  const [arquivo, setArquivo] = useState<{ url: string; nome: string } | null>(
    item?.desafio.arquivoUrl
      ? { url: item.desafio.arquivoUrl, nome: item.desafio.arquivoNome ?? "Arquivo" }
      : null
  );
  const [enviando, setEnviando] = useState<"imagem" | "arquivo" | null>(null);
  const [regras, setRegras] = useState<Regras>(
    item?.desafio.regras ?? modelo?.regras ?? REGRAS_PADRAO
  );
  const [convidados, setConvidados] = useState<string[]>(participantes);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (nome.trim().length < 3) return setErro("Dê um nome ao desafio.");
    if (fim < inicio) return setErro("O fim não pode ser antes do começo.");
    if (tipo === "pontos" && Object.values(regras).every((v) => v === 0)) {
      return setErro("Pelo menos um hábito precisa valer ponto.");
    }
    const alvo = Number(objetivo.replace(",", "."));
    if (tipo === "meta" && (!Number.isFinite(alvo) || alvo <= 0)) {
      return setErro("Diga quanto é a meta, por exemplo 5.");
    }
    if (!aberto && convidados.length === 0) {
      return setErro("Escolha quem participa ou deixe o desafio aberto a todos.");
    }

    setSalvando(true);
    const supabase = createClient();

    const dados = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      inicio,
      fim,
      aberto,
      regras,
      tipo,
      // Medida e objetivo só existem no desafio de meta; no de pontos ficam nulos.
      metrica: tipo === "meta" ? metrica : null,
      objetivo: tipo === "meta" ? alvo : null,
      imagem_url: imagemUrl,
      arquivo_url: arquivo?.url ?? null,
      arquivo_nome: arquivo?.nome ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = item
      ? await supabase.from("desafios").update(dados).eq("id", item.desafio.id).select("id").single()
      : await supabase
          .from("desafios")
          .insert({ ...dados, criado_por: professorId })
          .select("id")
          .single();

    if (error || !data) {
      setSalvando(false);
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }

    // Convite é uma linha 'convidado': o aluno aceita no app dele. Quem foi
    // desmarcado e ainda não aceitou, sai; quem já aceitou, fica.
    const novos = convidados.filter((id) => !participantes.includes(id));
    const retirados = participantes.filter((id) => !convidados.includes(id));

    if (novos.length > 0) {
      await supabase.from("desafio_participantes").insert(
        novos.map((alunoId) => ({
          desafio_id: data.id,
          aluno_id: alunoId,
          status: "convidado",
        }))
      );
    }
    if (retirados.length > 0) {
      await supabase
        .from("desafio_participantes")
        .delete()
        .eq("desafio_id", data.id)
        .eq("status", "convidado")
        .in("aluno_id", retirados);
    }

    setSalvando(false);
    onPronto();
  }

  async function enviarArquivo(file: File, qual: "imagem" | "arquivo") {
    setErro(null);

    const limite = qual === "imagem" ? 5 : 10;
    if (file.size > limite * 1024 * 1024) {
      setErro(`O arquivo passa de ${limite} MB. Escolha um menor.`);
      return;
    }

    setEnviando(qual);

    const supabase = createClient();
    const limpo = file.name.replace(/[^\w.\- ]+/g, "").slice(-60) || "arquivo";
    const caminho = `${professorId}/${crypto.randomUUID()}-${limpo}`;

    const { error } = await supabase.storage
      .from("desafios")
      .upload(caminho, file, { contentType: file.type });

    if (error) {
      setEnviando(null);
      setErro("Não conseguimos enviar o arquivo. Tente de novo.");
      return;
    }

    const { data } = supabase.storage.from("desafios").getPublicUrl(caminho);
    if (qual === "imagem") setImagemUrl(data.publicUrl);
    else setArquivo({ url: data.publicUrl, nome: file.name });

    setEnviando(null);
  }

  const total = Object.values(regras).reduce((s, v) => s + v, 0);

  return (
    <Dialog open onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={salvar} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>
              {item ? "Editar desafio" : modelo ? modelo.nome : "Novo desafio"}
            </DialogTitle>
            <DialogDescription>
              A pontuação sai sozinha do que o aluno já registra no app. Ninguém precisa postar nada.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="de-nome" className="text-neutral-700">
              Nome
            </Label>
            <Input
              id="de-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Setembro em movimento"
              disabled={salvando}
              autoFocus={!item}
              className={CAMPO}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="de-descricao" className="text-neutral-700">
              Descrição <span className="font-normal text-neutral-400">(opcional)</span>
            </Label>
            <Input
              id="de-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Quem aparecer e se cuidar todo dia, ganha"
              disabled={salvando}
              className={CAMPO}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="de-inicio" className="text-neutral-700">
                Começa
              </Label>
              <Input
                id="de-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                disabled={salvando}
                className={CAMPO}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="de-fim" className="text-neutral-700">
                Termina
              </Label>
              <Input
                id="de-fim"
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                disabled={salvando}
                className={CAMPO}
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2.5" disabled={salvando}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">Como funciona</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  valor: "pontos" as TipoDesafio,
                  icone: Trophy,
                  titulo: "Pontos por hábito",
                  texto: "Cada hábito do dia vale ponto. Bom para constância.",
                },
                {
                  valor: "meta" as TipoDesafio,
                  icone: Target,
                  titulo: "Meta a alcançar",
                  texto: "Uma medida e um objetivo, tipo 5 km em 30 dias.",
                },
              ].map(({ valor, icone: Icone, titulo, texto }) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setTipo(valor)}
                  aria-pressed={tipo === valor}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-[14px] px-4 py-3 text-left transition-all duration-200 active:scale-[.98]",
                    tipo === valor
                      ? "bg-grafite text-white"
                      : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  <Icone
                    className={cn("size-4", tipo === valor ? "text-ciano" : "text-neutral-400")}
                    strokeWidth={1.9}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold">{titulo}</span>
                  <span className={cn("text-[12px] leading-tight", tipo === valor ? "text-white/60" : "text-neutral-500")}>
                    {texto}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {tipo === "meta" && (
            <fieldset className="flex flex-col gap-2.5" disabled={salvando}>
              <legend className="mb-2 text-sm font-medium text-neutral-700">A meta</legend>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(METRICAS) as Metrica[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetrica(m)}
                    aria-pressed={metrica === m}
                    className={cn(
                      "min-h-11 rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                      metrica === m
                        ? "bg-grafite text-white"
                        : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    )}
                  >
                    {METRICAS[m].titulo}
                  </button>
                ))}
              </div>

              <div className="mt-1 flex items-center gap-3">
                <Input
                  id="de-objetivo"
                  inputMode="decimal"
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value.replace(/[^\d,.]/g, ""))}
                  aria-label="Quanto é a meta"
                  className="numero h-12 w-28 rounded-[14px] px-4 text-center text-base"
                />
                <p className="text-sm text-neutral-600">
                  {METRICAS[metrica].unidade} por aluno, até {dataCurta(fim)}
                </p>
              </div>

              <p className="text-[13px] leading-relaxed text-neutral-500">
                {METRICAS[metrica].comoConta}
              </p>
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-2.5" disabled={salvando}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">
              Imagem e arquivo <span className="font-normal text-neutral-400">(opcional)</span>
            </legend>

            {imagemUrl && (
              <div className="relative overflow-hidden rounded-[14px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagemUrl} alt="" className="h-32 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImagemUrl(null)}
                  aria-label="Remover imagem"
                  className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-neutral-50 px-4 text-sm font-medium text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-100">
                {enviando === "imagem" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="size-4 text-neutral-400" strokeWidth={1.9} aria-hidden />
                )}
                {imagemUrl ? "Trocar imagem" : "Imagem de capa"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={Boolean(enviando) || salvando}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) enviarArquivo(file, "imagem");
                  }}
                />
              </label>

              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-neutral-50 px-4 text-sm font-medium text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-100">
                {enviando === "arquivo" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Paperclip className="size-4 text-neutral-400" strokeWidth={1.9} aria-hidden />
                )}
                {arquivo ? "Trocar arquivo" : "Anexar arquivo"}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
                  className="sr-only"
                  disabled={Boolean(enviando) || salvando}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) enviarArquivo(file, "arquivo");
                  }}
                />
              </label>
            </div>

            {arquivo && (
              <p className="flex items-center gap-2 text-[13px] text-neutral-600">
                <FileText className="size-4 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{arquivo.nome}</span>
                <button
                  type="button"
                  onClick={() => setArquivo(null)}
                  className="shrink-0 font-semibold text-saude-vermelho"
                >
                  Remover
                </button>
              </p>
            )}

            <p className="text-[13px] leading-relaxed text-neutral-500">
              A capa aparece no card do desafio. O arquivo (regulamento, tabela, cartaz) fica para o
              aluno baixar. Imagem até 5 MB, arquivo até 10 MB.
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-2.5" disabled={salvando}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">Quem participa</legend>
            <div className="flex gap-2">
              {[
                { texto: "Aberto a todos", valor: true },
                { texto: "Só convidados", valor: false },
              ].map(({ texto, valor }) => (
                <button
                  key={texto}
                  type="button"
                  onClick={() => setAberto(valor)}
                  aria-pressed={aberto === valor}
                  className={cn(
                    "h-11 flex-1 rounded-full text-sm font-medium transition-all duration-200 active:scale-[.98]",
                    aberto === valor
                      ? "bg-grafite text-white"
                      : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  {texto}
                </button>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-500">
              {aberto
                ? "Todo aluno vê o desafio e entra se quiser. Você pode convidar alguém mesmo assim."
                : "Só quem você convidar vê o desafio, e cada um aceita no app dele."}
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-2" disabled={salvando}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">
              Convidar <span className="font-normal text-neutral-400">({convidados.length} escolhidos)</span>
            </legend>
            <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-[14px] bg-neutral-50 p-3">
              {alunos.map((aluno) => {
                const marcado = convidados.includes(aluno.id);
                return (
                  <button
                    key={aluno.id}
                    type="button"
                    onClick={() =>
                      setConvidados((atuais) =>
                        marcado ? atuais.filter((id) => id !== aluno.id) : [...atuais, aluno.id]
                      )
                    }
                    aria-pressed={marcado}
                    className={cn(
                      "min-h-10 rounded-full px-3.5 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                      marcado
                        ? "bg-grafite text-white"
                        : "bg-card text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                    )}
                  >
                    {aluno.nome.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={cn("flex-col gap-2", tipo === "pontos" ? "flex" : "hidden")} disabled={salvando}>
            <legend className="mb-2 text-sm font-medium text-neutral-700">
              Quanto vale cada hábito, por dia
            </legend>
            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-[14px] ring-1 ring-neutral-200">
              {HABITOS.map(({ chave, titulo, descricao, icone: Icone }) => (
                <li key={chave} className="flex items-center gap-3 px-3.5 py-2.5">
                  <Icone className="size-4 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800">{titulo}</p>
                    <p className="text-[12px] text-neutral-500">{descricao}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    value={regras[chave]}
                    onChange={(e) =>
                      setRegras((atuais) => ({
                        ...atuais,
                        [chave]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      }))
                    }
                    aria-label={`Pontos por dia: ${titulo}`}
                    className="numero h-10 w-16 shrink-0 rounded-[12px] px-2 text-center text-base"
                  />
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-neutral-500">
              Um dia perfeito vale <span className="numero font-semibold text-neutral-950">{total}</span> pontos.
            </p>
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
            ) : item ? (
              "Salvar alterações"
            ) : (
              "Criar desafio"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
