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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* ── Dados do treino ──────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="aluno" className="text-neutral-700">
            Aluno
          </Label>
          <select
            id="aluno"
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            disabled={salvando || Boolean(treino)}
            className="h-12 rounded-xl border border-input bg-transparent px-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <option value="">Selecione…</option>
            {alunos.map((aluno) => (
              <option key={aluno.id} value={aluno.id}>
                {aluno.nome}
              </option>
            ))}
          </select>
          {treino && (
            <p className="text-xs text-neutral-500">
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
            placeholder="Treino A — membros inferiores"
            disabled={salvando}
            className="h-12 rounded-xl px-3.5 text-base"
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
            className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          />
        </div>

        <fieldset className="flex flex-col gap-2" disabled={salvando}>
          <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
            Dias da semana
          </legend>
          <div className="flex flex-wrap gap-2">
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
                    "size-12 rounded-xl border text-sm font-medium transition-colors",
                    marcado
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  {NOME_DIA[dia]}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-neutral-500">
            Sem nenhum dia marcado, o treino vale para todos os dias.
          </p>
        </fieldset>

        {treino && (
          <label className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3.5 py-3">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              disabled={salvando}
              className="size-5 accent-primary"
            />
            <span className="text-sm text-neutral-700">
              Treino ativo — o aluno vê na tela dele
            </span>
          </label>
        )}
      </section>

      {/* ── Exercícios ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Exercícios
        </h2>

        {linhas.map((linha, indice) => (
          <LinhaExercicioForm
            key={linha.chave}
            linha={linha}
            indice={indice}
            total={linhas.length}
            professorId={professorId}
            desabilitado={salvando}
            onMudar={(campos) => atualizarLinha(linha.chave, campos)}
            onRemover={() => removerLinha(linha.chave)}
            onMover={(direcao) => mover(indice, direcao)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => setLinhas((atuais) => [...atuais, linhaVazia()])}
          disabled={salvando}
          className="h-12 rounded-xl font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          Adicionar exercício
        </Button>
      </section>

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
            Salvando...
          </>
        ) : treino ? (
          "Salvar alterações"
        ) : (
          "Criar treino"
        )}
      </Button>
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-500">
          {indice + 1}
        </span>

        <Input
          value={linha.nome}
          onChange={(e) => onMudar({ nome: e.target.value })}
          placeholder="Nome do exercício"
          disabled={desabilitado}
          aria-label={`Nome do exercício ${indice + 1}`}
          className="h-11 flex-1 rounded-xl px-3.5 text-base font-medium"
        />

        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMover(-1)}
            disabled={desabilitado || indice === 0}
            aria-label="Mover para cima"
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMover(1)}
            disabled={desabilitado || indice === total - 1}
            aria-label="Mover para baixo"
          >
            <ArrowDown className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemover}
            disabled={desabilitado}
            aria-label="Remover exercício"
            className="text-saude-vermelho"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            { campo: "series", rotulo: "Séries", exemplo: "3" },
            { campo: "repeticoes", rotulo: "Repetições", exemplo: "12" },
            { campo: "carga", rotulo: "Carga", exemplo: "20 kg" },
            { campo: "descanso", rotulo: "Descanso", exemplo: "60s" },
          ] as const
        ).map(({ campo, rotulo, exemplo }) => (
          <div key={campo} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500">
              {rotulo}
            </label>
            <Input
              value={linha[campo]}
              onChange={(e) => onMudar({ [campo]: e.target.value })}
              placeholder={exemplo}
              inputMode={campo === "series" ? "numeric" : "text"}
              disabled={desabilitado}
              className="h-11 rounded-xl px-3 text-base"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-neutral-500">
          Vídeo de demonstração
        </label>
        <div className="flex gap-2">
          <Input
            value={linha.videoUrl}
            onChange={(e) => onMudar({ videoUrl: e.target.value })}
            placeholder="Cole um link do YouTube ou envie um arquivo"
            disabled={desabilitado || enviando}
            className="h-11 flex-1 rounded-xl px-3.5 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            disabled={desabilitado || enviando}
            className="h-11 shrink-0 rounded-xl px-3"
            render={<label />}
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            <span className="sr-only">Enviar vídeo</span>
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

        {linha.videoUrl && !erroUpload && (
          <p className="flex items-center gap-1.5 text-xs text-saude-verde">
            <Video className="size-3.5 shrink-0" aria-hidden />
            Vídeo vinculado
          </p>
        )}
        {erroUpload && (
          <p role="alert" className="text-xs text-saude-vermelho">
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
        className="h-11 rounded-xl px-3.5 text-sm"
      />
    </div>
  );
}
