"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Anamnese } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

/** Doenças que o professor precisa saber antes de prescrever qualquer coisa. */
const DOENCAS = [
  "Diabetes",
  "Hipertensão",
  "Colesterol alto",
  "Problema cardíaco",
  "Asma",
  "Problema de tireoide",
  "Artrose / artrite",
  "Osteoporose",
  "Hérnia de disco",
  "Depressão / ansiedade",
];

const FREQUENCIAS = [
  "Nunca pratiquei",
  "Parei há mais de um ano",
  "Parei há alguns meses",
  "Pratico às vezes",
  "Pratico toda semana",
];

const SONO = ["Durmo bem", "Durmo razoável", "Durmo mal", "Tenho insônia"];

const ALCOOL = ["Não bebo", "Socialmente", "Toda semana", "Todo dia"];

interface FormularioAnamneseProps {
  alunoId: string;
  anamnese: Anamnese | null;
}

export function FormularioAnamnese({
  alunoId,
  anamnese,
}: FormularioAnamneseProps) {
  const router = useRouter();

  const [doencas, setDoencas] = useState<string[]>(anamnese?.doencas ?? []);
  const [objetivo, setObjetivo] = useState(anamnese?.objetivo ?? "");
  const [lesoes, setLesoes] = useState(anamnese?.lesoes ?? "");
  const [cirurgias, setCirurgias] = useState(anamnese?.cirurgias ?? "");
  const [alergias, setAlergias] = useState(anamnese?.alergias ?? "");
  const [medicamentos, setMedicamentos] = useState(
    anamnese?.medicamentos_uso ?? ""
  );
  const [historico, setHistorico] = useState(anamnese?.historico_familiar ?? "");
  const [pratica, setPratica] = useState(anamnese?.pratica_atividade ?? "");
  const [fumante, setFumante] = useState<boolean | null>(
    anamnese?.fumante ?? null
  );
  const [alcool, setAlcool] = useState(anamnese?.consumo_alcool ?? "");
  const [sono, setSono] = useState(anamnese?.qualidade_sono ?? "");
  const [restricoes, setRestricoes] = useState(
    anamnese?.restricoes_medicas ?? ""
  );
  const [liberado, setLiberado] = useState<boolean | null>(
    anamnese?.liberado_por_medico ?? null
  );
  const [observacoes, setObservacoes] = useState(anamnese?.observacoes ?? "");

  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [, iniciarTransicao] = useTransition();

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSalvo(false);

    if (!objetivo.trim()) {
      setErro("Conte o que você busca no centro — é o que guia o treino.");
      return;
    }

    setSalvando(true);

    const { error } = await createClient().from("anamneses").upsert(
      {
        aluno_id: alunoId,
        doencas: doencas.length > 0 ? doencas : null,
        objetivo: objetivo.trim(),
        lesoes: lesoes.trim() || null,
        cirurgias: cirurgias.trim() || null,
        alergias: alergias.trim() || null,
        medicamentos_uso: medicamentos.trim() || null,
        historico_familiar: historico.trim() || null,
        pratica_atividade: pratica || null,
        fumante,
        consumo_alcool: alcool || null,
        qualidade_sono: sono || null,
        restricoes_medicas: restricoes.trim() || null,
        liberado_por_medico: liberado,
        observacoes: observacoes.trim() || null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "aluno_id" }
    );

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }

    setSalvo(true);
    iniciarTransicao(() => router.refresh());
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-6" noValidate>
      <Secao
        titulo="Seu objetivo"
        descricao="A resposta mais importante do formulário."
      >
        <textarea
          rows={2}
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="Controlar a diabetes, ganhar disposição, voltar a subir escada sem cansar…"
          disabled={salvando}
          className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        />
      </Secao>

      <Secao titulo="Histórico de saúde">
        <Escolhas
          rotulo="Você tem alguma dessas condições?"
          opcoes={DOENCAS}
          selecionadas={doencas}
          multipla
          desabilitado={salvando}
          onAlternar={(valor) =>
            setDoencas((atuais) =>
              atuais.includes(valor)
                ? atuais.filter((d) => d !== valor)
                : [...atuais, valor]
            )
          }
        />

        <Texto
          id="lesoes"
          rotulo="Lesões — atuais ou antigas"
          valor={lesoes}
          onMudar={setLesoes}
          placeholder="Dor no ombro direito, joelho que trava…"
          desabilitado={salvando}
        />

        <Texto
          id="cirurgias"
          rotulo="Cirurgias"
          valor={cirurgias}
          onMudar={setCirurgias}
          placeholder="Quais e quando"
          desabilitado={salvando}
        />

        <Texto
          id="alergias"
          rotulo="Alergias"
          valor={alergias}
          onMudar={setAlergias}
          placeholder="Medicamentos, alimentos, látex…"
          desabilitado={salvando}
        />

        <Texto
          id="medicamentos"
          rotulo="Medicamentos em uso"
          valor={medicamentos}
          onMudar={setMedicamentos}
          placeholder="Nome e dose de tudo que você toma"
          desabilitado={salvando}
        />

        <Texto
          id="historico"
          rotulo="Histórico familiar"
          valor={historico}
          onMudar={setHistorico}
          placeholder="Infarto, AVC, diabetes na família"
          desabilitado={salvando}
        />
      </Secao>

      <Secao titulo="Rotina">
        <Escolhas
          rotulo="Você já praticava atividade física?"
          opcoes={FREQUENCIAS}
          selecionadas={pratica ? [pratica] : []}
          desabilitado={salvando}
          onAlternar={(valor) => setPratica(pratica === valor ? "" : valor)}
        />

        <Escolhas
          rotulo="Como você dorme?"
          opcoes={SONO}
          selecionadas={sono ? [sono] : []}
          desabilitado={salvando}
          onAlternar={(valor) => setSono(sono === valor ? "" : valor)}
        />

        <Escolhas
          rotulo="Bebida alcoólica"
          opcoes={ALCOOL}
          selecionadas={alcool ? [alcool] : []}
          desabilitado={salvando}
          onAlternar={(valor) => setAlcool(alcool === valor ? "" : valor)}
        />

        <SimNao
          rotulo="Você fuma?"
          valor={fumante}
          onMudar={setFumante}
          desabilitado={salvando}
        />
      </Secao>

      <Secao titulo="Liberação médica">
        <SimNao
          rotulo="Seu médico liberou você para atividade física?"
          valor={liberado}
          onMudar={setLiberado}
          desabilitado={salvando}
        />

        <Texto
          id="restricoes"
          rotulo="Restrições que o médico passou"
          valor={restricoes}
          onMudar={setRestricoes}
          placeholder="Nada de impacto, não passar de 120 bpm…"
          desabilitado={salvando}
        />

        <Texto
          id="obs-anamnese"
          rotulo="Mais alguma coisa que devemos saber?"
          valor={observacoes}
          onMudar={setObservacoes}
          placeholder="Opcional"
          desabilitado={salvando}
        />
      </Secao>

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-saude-vermelho-light px-3.5 py-3 text-sm text-saude-vermelho"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      {salvo && !erro && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-saude-verde-light px-3.5 py-3 text-sm text-saude-verde"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          Anamnese salva. Seu professor já consegue ver.
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
        ) : anamnese ? (
          "Atualizar anamnese"
        ) : (
          "Enviar anamnese"
        )}
      </Button>
    </form>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <h2 className="text-base font-bold text-neutral-900">{titulo}</h2>
        {descricao && (
          <p className="mt-0.5 text-sm text-neutral-500">{descricao}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Texto({
  id,
  rotulo,
  valor,
  onMudar,
  placeholder,
  desabilitado,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onMudar: (valor: string) => void;
  placeholder?: string;
  desabilitado: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-neutral-700">
        {rotulo}
      </Label>
      <Input
        id={id}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        disabled={desabilitado}
        className="h-12 rounded-xl px-3.5 text-base"
      />
    </div>
  );
}

function Escolhas({
  rotulo,
  opcoes,
  selecionadas,
  multipla,
  desabilitado,
  onAlternar,
}: {
  rotulo: string;
  opcoes: string[];
  selecionadas: string[];
  multipla?: boolean;
  desabilitado: boolean;
  onAlternar: (valor: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={desabilitado}>
      <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
        {rotulo}
        {multipla && (
          <span className="font-normal text-neutral-400"> (marque quantas quiser)</span>
        )}
      </legend>

      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => {
          const marcada = selecionadas.includes(opcao);

          return (
            <button
              key={opcao}
              type="button"
              onClick={() => onAlternar(opcao)}
              aria-pressed={marcada}
              className={cn(
                "rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                marcada
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {opcao}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SimNao({
  rotulo,
  valor,
  onMudar,
  desabilitado,
}: {
  rotulo: string;
  valor: boolean | null;
  onMudar: (valor: boolean | null) => void;
  desabilitado: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={desabilitado}>
      <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
        {rotulo}
      </legend>

      <div className="flex gap-2">
        {[
          { texto: "Sim", escolha: true },
          { texto: "Não", escolha: false },
        ].map(({ texto, escolha }) => (
          <button
            key={texto}
            type="button"
            onClick={() => onMudar(valor === escolha ? null : escolha)}
            aria-pressed={valor === escolha}
            className={cn(
              "h-11 w-24 rounded-xl border text-sm transition-colors",
              valor === escolha
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {texto}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
