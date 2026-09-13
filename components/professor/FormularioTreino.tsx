"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DIAS_SEMANA, type DiaSemana } from "@/lib/utils/datas";
import type { TreinoEdicao } from "@/lib/supabase/professor";

const NOME_DIA: Record<DiaSemana, string> = {
  dom: "Dom",
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
};

/** 200 MB — acima disso o upload no celular do professor não termina. */
const TAMANHO_MAXIMO_VIDEO = 200 * 1024 * 1024;

const CAMPO_BASE =
  "rounded-[14px] border border-input bg-card text-base transition-colors outline-none hover:border-neutral-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";
const TEXTAREA = cn(CAMPO_BASE, "w-full resize-none px-3.5 py-3 placeholder:text-neutral-400");

interface LinhaExercicio {
  /** Id do banco; ausente enquanto o exercício só existe na tela. */
  id?: string;
  chave: string;
  nome: string;
  series: string;
  repeticoes: string;
  carga: string;
  descanso: string;
  videoUrl: string;
  observacoes: string;
}

function linhaVazia(): LinhaExercicio {
  return {
    chave: crypto.randomUUID(),
    nome: "",
    series: "3",
    repeticoes: "12",
    carga: "",
    descanso: "60s",
    videoUrl: "",
    observacoes: "",
  };
}

interface FormularioTreinoProps {
  professorId: string;
  alunos: Profile[];
  treino?: TreinoEdicao;
}

export function FormularioTreino({
  professorId,
  alunos,
  treino,
}: FormularioTreinoProps) {
  const router = useRouter();
  const supabase = createClient();

  const [alunoId, setAlunoId] = useState(treino?.alunoId ?? "");
  const [nome, setNome] = useState(treino?.nome ?? "");
  const [descricao, setDescricao] = useState(treino?.descricao ?? "");
  const [dias, setDias] = useState<string[]>(treino?.diaSemana ?? []);
  const [ativo, setAtivo] = useState(treino?.ativo ?? true);

  const [linhas, setLinhas] = useState<LinhaExercicio[]>(() =>
    treino?.exercicios.length
      ? treino.exercicios.map((e) => ({
          id: e.id,
          chave: e.id,
          nome: e.nome,
          series: e.series?.toString() ?? "",
          repeticoes: e.repeticoes ?? "",
          carga: e.carga ?? "",
          descanso: e.descanso ?? "",
          videoUrl: e.videoUrl ?? "",
          observacoes: e.observacoes ?? "",
        }))
      : [linhaVazia()]
  );

  /** Ids que estavam no banco e o professor removeu da tela. */
  const removidos = useRef<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function atualizarLinha(chave: string, campos: Partial<LinhaExercicio>) {
    setLinhas((atuais) =>
      atuais.map((l) => (l.chave === chave ? { ...l, ...campos } : l))
    );
  }

  function removerLinha(chave: string) {
    setLinhas((atuais) => {
      const alvo = atuais.find((l) => l.chave === chave);
      if (alvo?.id) removidos.current.push(alvo.id);
      return atuais.filter((l) => l.chave !== chave);
    });
  }

  function mover(indice: number, direcao: -1 | 1) {
    setLinhas((atuais) => {
      const destino = indice + direcao;
      if (destino < 0 || destino >= atuais.length) return atuais;

      const copia = atuais.slice();
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (!alunoId) return setErro("Escolha o aluno deste treino.");
    if (nome.trim().length < 2) return setErro("Dê um nome ao treino.");

    const validos = linhas.filter((l) => l.nome.trim());
    if (validos.length === 0) {
      return setErro("Inclua ao menos um exercício com nome.");
    }

    setSalvando(true);

    const dadosTreino = {
      professor_id: professorId,
      aluno_id: alunoId,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      dia_semana: dias,
      ativo,
    };

    const { data: salvo, error: erroTreino } = treino
      ? await supabase
          .from("treinos")
          .update(dadosTreino)
          .eq("id", treino.id)
          .select("id")
          .single()
      : await supabase.from("treinos").insert(dadosTreino).select("id").single();

    if (erroTreino || !salvo) {
      setSalvando(false);
      return setErro("Não conseguimos salvar o treino. Tente de novo.");
    }

    const treinoId = salvo.id as string;

    if (removidos.current.length > 0) {
      await supabase
        .from("exercicios")
        .delete()
        .in("id", removidos.current);
      removidos.current = [];
    }

    /*
      Atualiza quem já existe em vez de recriar tudo: `exercicio_execucoes`
      aponta para esses ids, e apagar levaria o histórico do aluno junto.
    */
    const paraAtualizar = validos.filter((l) => l.id);
    const paraInserir = validos.filter((l) => !l.id);

    const camposDe = (l: LinhaExercicio, ordem: number) => ({
      treino_id: treinoId,
      nome: l.nome.trim(),
      series: l.series.trim() ? Number(l.series) : null,
      repeticoes: l.repeticoes.trim() || null,
      carga: l.carga.trim() || null,
      descanso: l.descanso.trim() || null,
      video_url: l.videoUrl.trim() || null,
      observacoes: l.observacoes.trim() || null,
      ordem,
    });

    const erros = await Promise.all([
      ...paraAtualizar.map((l) =>
        supabase
          .from("exercicios")
          .update(camposDe(l, validos.indexOf(l)))
          .eq("id", l.id!)
          .then(({ error }) => error)
      ),
      paraInserir.length > 0
        ? supabase
            .from("exercicios")
            .insert(paraInserir.map((l) => camposDe(l, validos.indexOf(l))))
            .then(({ error }) => error)
        : Promise.resolve(null),
    ]);

    setSalvando(false);

    if (erros.some(Boolean)) {
      return setErro(
        "O treino foi salvo, mas algum exercício falhou. Confira a lista."
      );
    }

    router.push("/treinos");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]"
      noValidate
    >
      {/* ── Dados do treino ──────────────────────────────────────── */}
      <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6 lg:sticky lg:top-40">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
          Dados do treino
        </h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="aluno" className="text-neutral-700">
            Aluno
          </Label>
          <select
            id="aluno"
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            disabled={salvando || Boolean(treino)}
            className={cn(CAMPO_BASE, "h-12 w-full px-3.5")}
          >
            <option value="">Selecione…</option>
            {alunos.map((aluno) => (
              <option key={aluno.id} value={aluno.id}>
                {aluno.nome}
              </option>
            ))}
          </select>
          {treino && (
            <p className="text-[13px] text-neutral-500">
              Para trocar o aluno, crie um treino novo.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nome" className="text-neutral-700">
            Nome do treino
          </Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Treino A: membros inferiores"
            disabled={salvando}
            className="h-12 px-3.5 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="descricao" className="text-neutral-700">
            Orientação para o aluno{" "}
            <span className="font-normal text-neutral-400">(opcional)</span>
          </Label>
          <textarea
            id="descricao"
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Aquecer 5 minutos na esteira antes de começar."
            disabled={salvando}
            className={TEXTAREA}
          />
        </div>

        <fieldset className="flex flex-col gap-2" disabled={salvando}>
          <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
            Dias da semana
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map((dia) => {
              const marcado = dias.includes(dia);

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() =>
                    setDias((atuais) =>
                      marcado
                        ? atuais.filter((d) => d !== dia)
                        : [...atuais, dia]
                    )
                  }
                  aria-pressed={marcado}
                  className={cn(
                    "size-12 rounded-full text-sm font-semibold transition-all duration-200 active:scale-[.96]",
                    marcado
                      ? "bg-grafite text-white"
                      : "bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  {NOME_DIA[dia]}
                </button>
              );
            })}
          </div>
          <p className="text-[13px] text-neutral-500">
            Sem nenhum dia marcado, o treino vale para todos os dias.
          </p>
        </fieldset>

        {treino && (
          <label className="flex cursor-pointer items-center gap-3 rounded-[14px] px-4 py-3 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              disabled={salvando}
              className="size-5 accent-primary"
            />
            <span className="text-sm text-neutral-700">
              Treino ativo: o aluno vê na tela dele
            </span>
          </label>
        )}
      </section>

      {/* ── Exercícios ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Exercícios
          </h2>
          <span className="rotulo text-neutral-400">
            {linhas.length} {linhas.length === 1 ? "item" : "itens"} · na ordem do treino
          </span>
        </div>

        <ol className="flex flex-col gap-3">
          {linhas.map((linha, indice) => (
            <li key={linha.chave}>
              <LinhaExercicioForm
                linha={linha}
                indice={indice}
                total={linhas.length}
                professorId={professorId}
                desabilitado={salvando}
                onMudar={(campos) => atualizarLinha(linha.chave, campos)}
                onRemover={() => removerLinha(linha.chave)}
                onMover={(direcao) => mover(indice, direcao)}
              />
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => setLinhas((atuais) => [...atuais, linhaVazia()])}
          disabled={salvando}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-dashed border-neutral-300 text-sm font-semibold text-neutral-600 transition-all duration-200 hover:border-neutral-400 hover:bg-card hover:text-neutral-950 active:scale-[.99] disabled:opacity-60"
        >
          <Plus className="size-4" aria-hidden />
          Adicionar exercício
        </button>

        {/* ── Salvar ─────────────────────────────────────────────── */}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {erro && (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-saude-vermelho sm:mr-auto"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={salvando}
            className="h-12 w-full rounded-full px-8 text-base font-semibold sm:w-auto"
          >
            {salvando ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Salvando...
              </>
            ) : treino ? (
              "Salvar alterações"
            ) : (
              "Criar treino"
            )}
          </Button>
        </div>
      </section>
    </form>
  );
}

function LinhaExercicioForm({
  linha,
  indice,
  total,
  professorId,
  desabilitado,
  onMudar,
  onRemover,
  onMover,
}: {
  linha: LinhaExercicio;
  indice: number;
  total: number;
  professorId: string;
  desabilitado: boolean;
  onMudar: (campos: Partial<LinhaExercicio>) => void;
  onRemover: () => void;
  onMover: (direcao: -1 | 1) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);

  async function enviarVideo(arquivo: File) {
    setErroUpload(null);

    if (arquivo.size > TAMANHO_MAXIMO_VIDEO) {
      setErroUpload("Vídeo acima de 200 MB. Grave um trecho mais curto.");
      return;
    }

    setEnviando(true);

    const supabase = createClient();
    const extensao = arquivo.name.split(".").pop() ?? "mp4";
    // O primeiro nível do caminho precisa ser o id de quem envia (RLS).
    const caminho = `${professorId}/${crypto.randomUUID()}.${extensao}`;

    const { error } = await supabase.storage
      .from("exercicios")
      .upload(caminho, arquivo, { contentType: arquivo.type });

    if (error) {
      setEnviando(false);
      setErroUpload("Não conseguimos enviar o vídeo. Tente de novo.");
      return;
    }

    const { data } = supabase.storage.from("exercicios").getPublicUrl(caminho);

    onMudar({ videoUrl: data.publicUrl });
    setEnviando(false);
  }

  const botaoIcone =
    "flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-neutral-200/90 md:p-5">
      <div className="flex items-center gap-3">
        <span className="numero flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600">
          {indice + 1}
        </span>
        <span className="rotulo flex-1 text-neutral-400">
          Exercício {indice + 1} de {total}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center rounded-full p-0.5 ring-1 ring-neutral-200">
            <button
              type="button"
              onClick={() => onMover(-1)}
              disabled={desabilitado || indice === 0}
              aria-label="Mover para cima"
              className={botaoIcone}
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onMover(1)}
              disabled={desabilitado || indice === total - 1}
              aria-label="Mover para baixo"
              className={botaoIcone}
            >
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={onRemover}
            disabled={desabilitado}
            aria-label="Remover exercício"
            className="flex size-10 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-saude-vermelho-light hover:text-saude-vermelho disabled:opacity-40"
          >
            <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
          </button>
        </div>
      </div>

      <Input
        value={linha.nome}
        onChange={(e) => onMudar({ nome: e.target.value })}
        placeholder="Nome do exercício"
        disabled={desabilitado}
        aria-label={`Nome do exercício ${indice + 1}`}
        className="h-12 px-3.5 text-base font-medium"
      />

      <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 sm:grid-cols-4">
        {(
          [
            { campo: "series", rotulo: "Séries", exemplo: "3" },
            { campo: "repeticoes", rotulo: "Repetições", exemplo: "12" },
            { campo: "carga", rotulo: "Carga", exemplo: "20 kg" },
            { campo: "descanso", rotulo: "Descanso", exemplo: "60s" },
          ] as const
        ).map(({ campo, rotulo, exemplo }) => (
          <div key={campo} className="flex flex-col gap-1.5">
            <label
              htmlFor={`${linha.chave}-${campo}`}
              className="text-[13px] font-medium text-neutral-500"
            >
              {rotulo}
            </label>
            <Input
              id={`${linha.chave}-${campo}`}
              value={linha[campo]}
              onChange={(e) => onMudar({ [campo]: e.target.value })}
              placeholder={exemplo}
              inputMode={campo === "series" ? "numeric" : "text"}
              disabled={desabilitado}
              className="numero h-11 px-3 text-base"
            />
          </div>
        ))}
      </div>

      {/* ── Vídeo ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-neutral-300 p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
            <Video className="size-4 text-neutral-400" strokeWidth={1.8} aria-hidden />
            Vídeo de demonstração
          </span>
          {linha.videoUrl && !erroUpload && (
            <span className="rounded-full bg-saude-verde-light px-2.5 py-0.5 text-[11px] font-semibold text-[#15803d]">
              Vídeo vinculado
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={linha.videoUrl}
            onChange={(e) => onMudar({ videoUrl: e.target.value })}
            placeholder="Cole um link do YouTube ou Vimeo"
            aria-label={`Link do vídeo do exercício ${indice + 1}`}
            disabled={desabilitado || enviando}
            className="h-11 flex-1 px-3.5 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            disabled={desabilitado || enviando}
            className="h-11 shrink-0 cursor-pointer rounded-full px-4"
            render={<label />}
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {enviando ? "Enviando..." : "Enviar arquivo"}
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              disabled={desabilitado || enviando}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) enviarVideo(arquivo);
                e.target.value = "";
              }}
            />
          </Button>
        </div>

        {erroUpload && (
          <p role="alert" className="text-sm text-saude-vermelho">
            {erroUpload}
          </p>
        )}
      </div>

      <Input
        value={linha.observacoes}
        onChange={(e) => onMudar({ observacoes: e.target.value })}
        placeholder="Observação para o aluno (opcional)"
        disabled={desabilitado}
        aria-label="Observação do exercício"
        className="h-11 px-3.5 text-sm"
      />
    </div>
  );
}
