"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Camera,
  Check,
  Copy,
  ExternalLink,
  FileHeart,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Plus,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Exame, ExameCompartilhamento, ExameTipo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { naAcademia } from "@/lib/utils/datas";
import {
  ACCEPT_EXAME,
  TAMANHO_MAXIMO_EXAME,
  TIPOS_EXAME,
  VALIDADES_LINK,
  caminhoCompartilhamento,
  ehPdf,
  formatarTamanho,
  gerarTokenCompartilhamento,
  mimeDoArquivo,
  nomeSeguro,
  rotuloTipoExame,
} from "@/lib/utils/exames";

const TITULO_SECAO =
  "text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl";
const CAMPO = "h-12 px-3.5 text-base md:text-base";
const CHIP_NEUTRO =
  "rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600";
const BOTAO_SECUNDARIO =
  "flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-50 active:scale-[.98] disabled:opacity-60";

/** `YYYY-MM-DD` → "12 mar 2026". Meio-dia UTC não escorrega de dia. */
function dataExame(iso: string) {
  return format(new Date(`${iso}T12:00:00Z`), "dd MMM yyyy", { locale: ptBR });
}

interface GerenciarExamesProps {
  alunoId: string;
  exames: Exame[];
  compartilhamentos: ExameCompartilhamento[];
  /** Hoje na academia, `YYYY-MM-DD` — vem do servidor. */
  hoje: string;
  indisponivel: boolean;
}

export function GerenciarExames({
  alunoId,
  exames,
  compartilhamentos,
  hoje,
  indisponivel,
}: GerenciarExamesProps) {
  const [enviando, setEnviando] = useState(false);

  if (indisponivel) {
    return (
      <div className="flex items-start gap-3.5 rounded-2xl bg-card px-5 py-4 ring-1 ring-neutral-200/90">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
        <p className="text-sm leading-relaxed text-neutral-500">
          O espaço de exames ainda está sendo ativado pelo centro. Volte daqui
          a pouco.
        </p>
      </div>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className={TITULO_SECAO}>Meus exames</h2>
        </div>

        {exames.length > 0 ? (
          <ListaExames exames={exames} />
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl bg-card px-5 py-6 ring-1 ring-neutral-200/90 md:px-7">
            <FileHeart className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
            <p className="text-[15px] font-semibold text-neutral-950">
              Seus exames num lugar só
            </p>
            <p className="text-sm leading-relaxed text-neutral-500">
              Envie o PDF do laboratório ou a foto do laudo: hemograma,
              ressonância, ultrassom, o que for. Fica guardado com a data e,
              na consulta, você manda um link para o médico ver tudo.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setEnviando(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-grafite text-[15px] font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98]"
        >
          <Plus className="size-5" aria-hidden />
          Enviar exame
        </button>

        <Dialog open={enviando} onOpenChange={(estado) => !estado && setEnviando(false)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[26px] sm:max-w-md">
            {enviando && (
              <FormularioExame
                alunoId={alunoId}
                hoje={hoje}
                onPronto={() => setEnviando(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </section>

      <section className="flex flex-col gap-3.5">
        <div>
          <h2 className={TITULO_SECAO}>Compartilhar com o médico</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
            Gere um link que abre todos os seus exames, sem precisar de conta.
            Ele vence sozinho e você pode cancelar quando quiser.
          </p>
        </div>
        <CompartilharExames
          alunoId={alunoId}
          compartilhamentos={compartilhamentos}
          semExames={exames.length === 0}
        />
      </section>
    </>
  );
}

// ── Lista ──────────────────────────────────────────────────────────

function ListaExames({ exames }: { exames: Exame[] }) {
  const [filtro, setFiltro] = useState<ExameTipo | "todos">("todos");

  const tiposPresentes = useMemo(
    () => TIPOS_EXAME.filter((t) => exames.some((e) => e.tipo === t.value)),
    [exames]
  );

  const filtrados =
    filtro === "todos" ? exames : exames.filter((e) => e.tipo === filtro);

  // Já vem ordenado por data desc; agrupa por ano mantendo a ordem.
  const porAno = filtrados.reduce<{ ano: string; itens: Exame[] }[]>(
    (grupos, exame) => {
      const ano = exame.data_exame.slice(0, 4);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.ano === ano) ultimo.itens.push(exame);
      else grupos.push({ ano, itens: [exame] });
      return grupos;
    },
    []
  );

  return (
    <div className="flex flex-col gap-3.5">
      {tiposPresentes.length > 1 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {[{ value: "todos" as const, label: "Todos" }, ...tiposPresentes].map(
            (opcao) => (
              <button
                key={opcao.value}
                type="button"
                onClick={() => setFiltro(opcao.value)}
                aria-pressed={filtro === opcao.value}
                className={cn(
                  "flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-all duration-200 active:scale-[.98]",
                  filtro === opcao.value
                    ? "bg-grafite text-white"
                    : "bg-card text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50"
                )}
              >
                {opcao.label}
              </button>
            )
          )}
        </div>
      )}

      {porAno.map((grupo) => (
        <div key={grupo.ano} className="flex flex-col gap-2">
          <p className="rotulo text-neutral-400">{grupo.ano}</p>
          <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
            {grupo.itens.map((exame) => (
              <LinhaExame key={exame.id} exame={exame} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function LinhaExame({ exame }: { exame: Exame }) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState<"abrindo" | "excluindo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const Icone = ehPdf(exame.mime) ? FileText : ImageIcon;
  const tamanho = formatarTamanho(exame.tamanho_bytes);

  async function abrir() {
    setErro(null);
    setOcupado("abrindo");

    /*
      A janela abre já no clique: depois de um `await`, o Safari do iPhone
      trata o `window.open` como pop-up e bloqueia.
    */
    const janela = window.open("", "_blank");

    const { data, error } = await createClient()
      .storage.from("exames")
      .createSignedUrl(exame.arquivo_path, 60 * 5);

    setOcupado(null);

    if (error || !data?.signedUrl) {
      janela?.close();
      setErro("Não conseguimos abrir o arquivo. Tente de novo.");
      return;
    }

    if (janela) {
      janela.opener = null;
      janela.location.href = data.signedUrl;
    } else {
      window.location.assign(data.signedUrl);
    }
  }

  async function excluir() {
    setErro(null);
    setOcupado("excluindo");

    const supabase = createClient();
    const { error: erroArquivo } = await supabase.storage
      .from("exames")
      .remove([exame.arquivo_path]);

    if (erroArquivo) {
      setOcupado(null);
      setErro("Não conseguimos excluir o arquivo. Tente de novo.");
      return;
    }

    const { error } = await supabase.from("exames").delete().eq("id", exame.id);

    setOcupado(null);

    if (error) {
      setErro("O arquivo saiu, mas o registro ficou. Tente excluir de novo.");
      return;
    }

    iniciarTransicao(() => router.refresh());
  }

  return (
    <li className="flex items-start gap-3.5 px-4 py-4 md:px-5">
      <Icone className="mt-0.5 size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={CHIP_NEUTRO}>{rotuloTipoExame(exame)}</span>
          <span className="rotulo text-neutral-400">{dataExame(exame.data_exame)}</span>
        </div>

        <p className="truncate text-[15px] font-semibold text-neutral-950">
          {exame.titulo || exame.arquivo_nome || "Exame"}
        </p>

        {(exame.titulo || tamanho) && (
          <p className="truncate text-[13px] text-neutral-500">
            {[exame.titulo ? exame.arquivo_nome : null, tamanho]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {exame.observacao && (
          <p className="text-[13px] leading-relaxed text-neutral-500">
            {exame.observacao}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {confirmando ? (
            <>
              <span className="text-sm text-neutral-700">Excluir este exame?</span>
              <button
                type="button"
                onClick={excluir}
                disabled={ocupado !== null}
                className="flex h-11 items-center gap-1.5 rounded-full bg-saude-vermelho px-4 text-sm font-semibold text-white transition-all duration-200 active:scale-[.98] disabled:opacity-60"
              >
                {ocupado === "excluindo" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-4" aria-hidden />
                )}
                Sim, excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={ocupado !== null}
                className={BOTAO_SECUNDARIO}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={abrir}
                disabled={ocupado !== null}
                className={BOTAO_SECUNDARIO}
              >
                {ocupado === "abrindo" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ExternalLink className="size-4" strokeWidth={1.8} aria-hidden />
                )}
                Abrir
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-neutral-500 transition-colors hover:text-saude-vermelho"
              >
                <Trash2 className="size-4" strokeWidth={1.8} aria-hidden />
                Excluir
              </button>
            </>
          )}
        </div>

        {erro && (
          <p role="alert" className="text-sm text-saude-vermelho">
            {erro}
          </p>
        )}
      </div>
    </li>
  );
}

// ── Envio ──────────────────────────────────────────────────────────

function FormularioExame({
  alunoId,
  hoje,
  onPronto,
}: {
  alunoId: string;
  hoje: string;
  onPronto: () => void;
}) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const entradaCamera = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState<ExameTipo | null>(null);
  const [tipoOutro, setTipoOutro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const [etapa, setEtapa] = useState<"arquivo" | "registro" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const salvando = etapa !== null;

  function escolher(selecionado: File | undefined) {
    setErro(null);
    if (!selecionado) return;

    if (!mimeDoArquivo(selecionado)) {
      setArquivo(null);
      setErro("Formato não aceito. Envie PDF ou imagem (JPG, PNG, WEBP ou HEIC).");
      return;
    }

    if (selecionado.size > TAMANHO_MAXIMO_EXAME) {
      setArquivo(null);
      setErro(
        `O arquivo tem ${formatarTamanho(selecionado.size)} e o limite é 20 MB. Tente exportar o PDF em qualidade menor.`
      );
      return;
    }

    setArquivo(selecionado);
  }

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (!arquivo) return setErro("Escolha o arquivo do exame.");
    if (!tipo) return setErro("Diga que tipo de exame é.");
    if (tipo === "outros" && tipoOutro.trim().length < 2)
      return setErro("Escreva que tipo de exame é.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data do exame.");
    if (data > hoje) return setErro("A data do exame não pode ser no futuro.");

    const mime = mimeDoArquivo(arquivo);
    if (!mime) return setErro("Formato não aceito. Envie PDF ou imagem.");

    const supabase = createClient();
    // O primeiro nível do caminho precisa ser o próprio id (RLS do storage).
    const caminho = `${alunoId}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;

    setEtapa("arquivo");

    const { error: erroUpload } = await supabase.storage
      .from("exames")
      .upload(caminho, arquivo, { contentType: mime, upsert: false });

    if (erroUpload) {
      setEtapa(null);
      const mensagem = erroUpload.message.toLowerCase();
      setErro(
        mensagem.includes("size") || mensagem.includes("large")
          ? "O arquivo passa do limite de 20 MB."
          : mensagem.includes("mime") || mensagem.includes("type")
            ? "Formato não aceito. Envie PDF ou imagem (JPG, PNG, WEBP ou HEIC)."
            : "Não conseguimos enviar o arquivo. Confira a internet e tente de novo."
      );
      return;
    }

    setEtapa("registro");

    const { error } = await supabase.from("exames").insert({
      aluno_id: alunoId,
      tipo,
      tipo_outro: tipo === "outros" ? tipoOutro.trim() : null,
      titulo: titulo.trim() || null,
      data_exame: data,
      arquivo_path: caminho,
      arquivo_nome: arquivo.name.slice(0, 200),
      mime,
      tamanho_bytes: arquivo.size,
      observacao: observacao.trim() || null,
    });

    if (error) {
      // Sem registro, o arquivo ficaria órfão no storage.
      await supabase.storage.from("exames").remove([caminho]);
      setEtapa(null);
      setErro("Não conseguimos salvar o exame. Tente de novo.");
      return;
    }

    setEtapa(null);
    onPronto();
    iniciarTransicao(() => router.refresh());
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-xl font-semibold tracking-[-0.02em] text-neutral-950">
          Enviar exame
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-neutral-500">
          PDF do laboratório ou foto do laudo, até 20 MB.
        </DialogDescription>
      </DialogHeader>

      {/* Arquivo */}
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-none font-medium text-neutral-700">Arquivo</span>

        {arquivo ? (
          <div className="flex items-center gap-3 rounded-[14px] bg-neutral-50 px-4 py-3 ring-1 ring-neutral-200">
            {ehPdf(mimeDoArquivo(arquivo)) ? (
              <FileText className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
            ) : (
              <ImageIcon className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-950">{arquivo.name}</p>
              <p className="text-[13px] text-neutral-500">{formatarTamanho(arquivo.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => entradaArquivo.current?.click()}
              disabled={salvando}
              className="h-10 shrink-0 rounded-full px-3 text-sm font-semibold text-primary disabled:opacity-60"
            >
              Trocar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => entradaArquivo.current?.click()}
              className="flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-50 active:scale-[.98]"
            >
              <Upload className="size-4" strokeWidth={1.8} aria-hidden />
              Escolher arquivo
            </button>
            <button
              type="button"
              onClick={() => entradaCamera.current?.click()}
              className="flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 transition-all duration-200 hover:bg-neutral-50 active:scale-[.98]"
            >
              <Camera className="size-4" strokeWidth={1.8} aria-hidden />
              Tirar foto
            </button>
          </div>
        )}

        <input
          ref={entradaArquivo}
          type="file"
          accept={ACCEPT_EXAME}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            escolher(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {/* No celular abre direto a câmera — bom para laudo em papel. */}
        <input
          ref={entradaCamera}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            escolher(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {/* Tipo */}
      <fieldset className="flex flex-col gap-2" disabled={salvando}>
        <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
          Tipo de exame
        </legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_EXAME.map((opcao) => (
            <button
              key={opcao.value}
              type="button"
              onClick={() => setTipo(opcao.value)}
              aria-pressed={tipo === opcao.value}
              className={cn(
                "flex h-11 items-center rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                tipo === opcao.value
                  ? "bg-grafite text-white"
                  : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
              )}
            >
              {opcao.label}
            </button>
          ))}
        </div>

        {tipo === "outros" && (
          <div className="mt-2 flex flex-col gap-2">
            <Label htmlFor="exame-tipo-outro" className="text-neutral-700">
              Que exame é?
            </Label>
            <Input
              id="exame-tipo-outro"
              value={tipoOutro}
              onChange={(e) => setTipoOutro(e.target.value)}
              placeholder="Teste ergométrico, holter, mamografia…"
              maxLength={80}
              autoFocus
              className={CAMPO}
            />
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="exame-data" className="text-neutral-700">
            Data do exame
          </Label>
          <Input
            id="exame-data"
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => setData(e.target.value)}
            disabled={salvando}
            className={CAMPO}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="exame-titulo" className="text-neutral-700">
            Nome <span className="font-normal text-neutral-400">(opcional)</span>
          </Label>
          <Input
            id="exame-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Hemograma completo"
            maxLength={120}
            disabled={salvando}
            className={CAMPO}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="exame-observacao" className="text-neutral-700">
          Observação <span className="font-normal text-neutral-400">(opcional)</span>
        </Label>
        <textarea
          id="exame-observacao"
          rows={2}
          maxLength={500}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Pedido pelo cardiologista, em jejum…"
          disabled={salvando}
          className="w-full resize-none rounded-[14px] border border-input bg-card px-4 py-3 text-base transition-colors outline-none placeholder:text-neutral-400 hover:border-neutral-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        />
      </div>

      {salvando && (
        <div role="status" className="flex flex-col gap-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={cn(
                "h-full rounded-full bg-ciano transition-all duration-500",
                etapa === "arquivo" ? "w-2/3" : "w-11/12"
              )}
            />
          </div>
          <p className="text-[13px] text-neutral-500">
            {etapa === "arquivo" ? "Enviando o arquivo…" : "Guardando o exame…"}
          </p>
        </div>
      )}

      {erro && (
        <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-white transition-all duration-200 hover:bg-primary/90 active:scale-[.98] disabled:opacity-70"
      >
        {salvando ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          "Enviar exame"
        )}
      </button>
    </form>
  );
}

// ── Compartilhamento ───────────────────────────────────────────────

function CompartilharExames({
  alunoId,
  compartilhamentos,
  semExames,
}: {
  alunoId: string;
  compartilhamentos: ExameCompartilhamento[];
  semExames: boolean;
}) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const [validade, setValidade] = useState<(typeof VALIDADES_LINK)[number]>(30);
  const [gerando, setGerando] = useState(false);
  const [novoToken, setNovoToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function urlDe(token: string) {
    return `${window.location.origin}${caminhoCompartilhamento(token)}`;
  }

  async function gerar() {
    setErro(null);
    setGerando(true);

    const token = gerarTokenCompartilhamento();
    // Instante absoluto: aqui não é "que dia é hoje", é "daqui a N dias".
    const expiraEm = new Date(Date.now() + validade * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await createClient()
      .from("exames_compartilhamentos")
      .insert({ aluno_id: alunoId, token, expira_em: expiraEm });

    setGerando(false);

    if (error) {
      setErro("Não conseguimos gerar o link. Tente de novo.");
      return;
    }

    setNovoToken(token);
    iniciarTransicao(() => router.refresh());
  }

  async function copiar(token: string) {
    setErro(null);
    try {
      await navigator.clipboard.writeText(urlDe(token));
      setCopiado(token);
      setTimeout(() => setCopiado((atual) => (atual === token ? null : atual)), 2500);
    } catch {
      setNovoToken(token);
      setErro("Não deu para copiar sozinho. Segure o link acima e copie.");
    }
  }

  async function compartilhar(token: string) {
    if (typeof navigator.share !== "function") return copiar(token);
    try {
      await navigator.share({
        title: "Meus exames",
        text: "Meus exames, compartilhados pelo app Atitude Vital:",
        url: urlDe(token),
      });
    } catch (e) {
      // Fechar a folha de compartilhamento não é erro.
      if ((e as DOMException)?.name !== "AbortError") await copiar(token);
    }
  }

  async function revogar(link: ExameCompartilhamento) {
    setErro(null);
    setRevogando(link.id);

    const { error } = await createClient()
      .from("exames_compartilhamentos")
      .update({ revogado: true })
      .eq("id", link.id);

    setRevogando(null);

    if (error) {
      setErro("Não conseguimos cancelar o link. Tente de novo.");
      return;
    }

    if (novoToken === link.token) setNovoToken(null);
    iniciarTransicao(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-7">
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-none font-medium text-neutral-700">
          Vale por
        </span>
        <div className="flex flex-wrap gap-2">
          {VALIDADES_LINK.map((dias) => (
            <button
              key={dias}
              type="button"
              onClick={() => setValidade(dias)}
              aria-pressed={validade === dias}
              className={cn(
                "flex h-11 items-center rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                validade === dias
                  ? "bg-grafite text-white"
                  : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
              )}
            >
              {dias} dias
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={gerar}
        disabled={gerando || semExames}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-white transition-all duration-200 hover:bg-primary/90 active:scale-[.98] disabled:opacity-60"
      >
        {gerando ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Link2 className="size-5" strokeWidth={1.8} aria-hidden />
        )}
        Gerar link
      </button>

      {semExames && (
        <p className="text-[13px] text-neutral-400">
          Envie pelo menos um exame para gerar o link.
        </p>
      )}

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}

      {compartilhamentos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="rotulo text-neutral-400">Links ativos</p>
          <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-[14px] ring-1 ring-neutral-200/90">
            {compartilhamentos.map((link) => (
              <li key={link.id} className="flex flex-col gap-2.5 px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="text-sm text-neutral-700">
                    Criado em{" "}
                    {format(naAcademia(link.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="rotulo text-neutral-400">
                    {link.expira_em
                      ? `Vale até ${format(naAcademia(link.expira_em), "dd/MM/yyyy", { locale: ptBR })}`
                      : "Sem prazo"}
                  </p>
                </div>

                {novoToken === link.token && (
                  <input
                    readOnly
                    value={urlDe(link.token)}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Link para o médico"
                    className="h-11 w-full rounded-[14px] bg-neutral-50 px-3.5 font-mono text-[13px] text-neutral-700 ring-1 ring-neutral-200 outline-none"
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => copiar(link.token)} className={BOTAO_SECUNDARIO}>
                    {copiado === link.token ? (
                      <Check className="size-4 text-saude-verde" aria-hidden />
                    ) : (
                      <Copy className="size-4" strokeWidth={1.8} aria-hidden />
                    )}
                    {copiado === link.token ? "Copiado" : "Copiar link"}
                  </button>
                  <button type="button" onClick={() => compartilhar(link.token)} className={BOTAO_SECUNDARIO}>
                    <Share2 className="size-4" strokeWidth={1.8} aria-hidden />
                    Compartilhar
                  </button>
                  <button
                    type="button"
                    onClick={() => revogar(link)}
                    disabled={revogando === link.id}
                    className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-neutral-500 transition-colors hover:text-saude-vermelho disabled:opacity-60"
                  >
                    {revogando === link.id && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    Revogar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
