"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Pill, Plus, Trash2, X } from "lucide-react";

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
import type { Medicamento } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { DIAS_SEMANA, type DiaSemana } from "@/lib/utils/datas";

const NOME_DIA: Record<DiaSemana, string> = {
  dom: "Dom",
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
};

const CAMPO = "h-12 px-3.5 text-base md:text-base";

interface GerenciarMedicamentosProps {
  alunoId: string;
  medicamentos: Medicamento[];
}

export function GerenciarMedicamentos({
  alunoId,
  medicamentos,
}: GerenciarMedicamentosProps) {
  const router = useRouter();
  const [emEdicao, setEmEdicao] = useState<Medicamento | null>(null);
  const [criando, setCriando] = useState(false);
  const [, iniciarTransicao] = useTransition();

  async function alternarAtivo(medicamento: Medicamento) {
    await createClient()
      .from("medicamentos")
      .update({ ativo: !medicamento.ativo })
      .eq("id", medicamento.id);

    iniciarTransicao(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3">
      {medicamentos.length > 0 ? (
        <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
          {medicamentos.map((medicamento) => (
            <li key={medicamento.id} className="flex items-center gap-2 py-1 pr-2 pl-4 md:pl-5">
              <button
                type="button"
                onClick={() => setEmEdicao(medicamento)}
                aria-label={`Editar ${medicamento.nome}`}
                className="group flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[15px] font-semibold",
                      medicamento.ativo ? "text-neutral-950" : "text-neutral-400"
                    )}
                  >
                    {medicamento.nome}
                    {medicamento.dose && (
                      <span className="font-normal text-neutral-500">
                        {" "}
                        · {medicamento.dose}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-neutral-500">
                    <span className="numero text-neutral-700">
                      {(medicamento.horarios ?? [])
                        .map((h) => h.slice(0, 5))
                        .join(" · ") || "Sem horário"}
                    </span>
                    {medicamento.dias_semana?.length
                      ? ` · ${medicamento.dias_semana.length} dias/semana`
                      : " · todos os dias"}
                  </p>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>

              <button
                type="button"
                onClick={() => alternarAtivo(medicamento)}
                aria-label={
                  medicamento.ativo
                    ? `Pausar ${medicamento.nome}`
                    : `Reativar ${medicamento.nome}`
                }
                className="flex h-11 shrink-0 items-center"
              >
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                    medicamento.ativo
                      ? "bg-saude-verde-light text-[#15803d]"
                      : "bg-neutral-100 text-neutral-500"
                  )}
                >
                  {medicamento.ativo ? "Ativo" : "Pausado"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3.5 rounded-2xl bg-card px-5 py-4 ring-1 ring-neutral-200/90">
          <Pill className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
          <p className="text-sm text-neutral-500">
            Nenhum medicamento cadastrado. Adicione o primeiro e escolha os
            horários.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setCriando(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-grafite text-[15px] font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98]"
      >
        <Plus className="size-5" aria-hidden />
        Cadastrar medicamento
      </button>

      <DialogMedicamento
        alunoId={alunoId}
        medicamento={emEdicao}
        aberto={criando || emEdicao !== null}
        onFechar={() => {
          setCriando(false);
          setEmEdicao(null);
        }}
      />
    </div>
  );
}

function DialogMedicamento({
  alunoId,
  medicamento,
  aberto,
  onFechar,
}: {
  alunoId: string;
  medicamento: Medicamento | null;
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();

  /*
    A `key` remonta o formulário quando o alvo muda — sem isso o estado do
    medicamento anterior vazaria para a próxima edição.
  */
  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[26px] sm:max-w-md">
        <FormularioMedicamento
          key={medicamento?.id ?? "novo"}
          alunoId={alunoId}
          medicamento={medicamento}
          onPronto={() => {
            onFechar();
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormularioMedicamento({
  alunoId,
  medicamento,
  onPronto,
}: {
  alunoId: string;
  medicamento: Medicamento | null;
  onPronto: () => void;
}) {
  const [nome, setNome] = useState(medicamento?.nome ?? "");
  const [dose, setDose] = useState(medicamento?.dose ?? "");
  const [condicao, setCondicao] = useState(medicamento?.condicao ?? "");
  const [horarios, setHorarios] = useState<string[]>(
    medicamento?.horarios?.map((h) => h.slice(0, 5)) ?? ["08:00"]
  );
  const [dias, setDias] = useState<string[]>(medicamento?.dias_semana ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (nome.trim().length < 2) {
      setErro("Diga o nome do medicamento.");
      return;
    }

    const validos = horarios.filter(Boolean).sort();
    if (validos.length === 0) {
      setErro("Informe ao menos um horário.");
      return;
    }

    setSalvando(true);

    const dados = {
      aluno_id: alunoId,
      nome: nome.trim(),
      dose: dose.trim() || null,
      condicao: condicao.trim() || null,
      horarios: validos,
      dias_semana: dias.length > 0 ? dias : null,
    };

    const supabase = createClient();
    const { error } = medicamento
      ? await supabase
          .from("medicamentos")
          .update(dados)
          .eq("id", medicamento.id)
      : await supabase.from("medicamentos").insert(dados);

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }

    onPronto();
  }

  async function excluir() {
    if (!medicamento) return;

    setExcluindo(true);

    const { error } = await createClient()
      .from("medicamentos")
      .delete()
      .eq("id", medicamento.id);

    setExcluindo(false);

    if (error) {
      setErro("Não conseguimos excluir. Tente pausar o medicamento.");
      return;
    }

    onPronto();
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-xl font-semibold tracking-[-0.02em] text-neutral-950">
          {medicamento ? "Editar medicamento" : "Novo medicamento"}
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-neutral-500">
          O app avisa em cada horário e o professor vê o que ficou pendente.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="med-nome" className="text-neutral-700">
          Nome
        </Label>
        <Input
          id="med-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Metformina"
          disabled={salvando}
          className={CAMPO}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="med-dose" className="text-neutral-700">
            Dose
          </Label>
          <Input
            id="med-dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="850 mg"
            disabled={salvando}
            className={CAMPO}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="med-condicao" className="text-neutral-700">
            Para quê
          </Label>
          <Input
            id="med-condicao"
            value={condicao}
            onChange={(e) => setCondicao(e.target.value)}
            placeholder="Diabetes"
            disabled={salvando}
            className={CAMPO}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2" disabled={salvando}>
        <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
          Horários
        </legend>

        <div className="flex flex-wrap gap-2">
          {horarios.map((horario, indice) => (
            <div
              key={indice}
              className="flex h-12 items-center gap-1 rounded-full bg-neutral-50 pr-1 pl-4 ring-1 ring-neutral-200"
            >
              <input
                type="time"
                value={horario}
                onChange={(e) =>
                  setHorarios((atuais) =>
                    atuais.map((h, i) => (i === indice ? e.target.value : h))
                  )
                }
                aria-label={`Horário ${indice + 1}`}
                className="numero w-[5.5rem] bg-transparent text-lg font-semibold text-neutral-950 outline-none"
              />
              {horarios.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setHorarios((atuais) =>
                      atuais.filter((_, i) => i !== indice)
                    )
                  }
                  aria-label={`Remover horário ${indice + 1}`}
                  className="flex size-10 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : (
                <span className="w-3" aria-hidden />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setHorarios((atuais) => [...atuais, "20:00"])}
            className="flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
          >
            <Plus className="size-4" aria-hidden />
            Outro horário
          </button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2" disabled={salvando}>
        <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
          Dias{" "}
          <span className="font-normal text-neutral-400">
            (nenhum marcado = todos os dias)
          </span>
        </legend>
        <div className="grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((dia) => {
            const marcado = dias.includes(dia);

            return (
              <button
                key={dia}
                type="button"
                onClick={() =>
                  setDias((atuais) =>
                    marcado ? atuais.filter((d) => d !== dia) : [...atuais, dia]
                  )
                }
                aria-pressed={marcado}
                className={cn(
                  "h-11 rounded-full text-[13px] font-semibold transition-all duration-200",
                  marcado
                    ? "bg-grafite text-white"
                    : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                )}
              >
                {NOME_DIA[dia]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {erro && (
        <p role="alert" className="text-sm text-saude-vermelho">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        {medicamento && (
          <Button
            type="button"
            variant="outline"
            onClick={excluir}
            disabled={salvando || excluindo}
            aria-label="Excluir medicamento"
            className="h-12 w-12 shrink-0 rounded-full text-saude-vermelho"
          >
            {excluindo ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-5" aria-hidden />
            )}
          </Button>
        )}

        <Button
          type="submit"
          disabled={salvando || excluindo}
          className="h-12 flex-1 rounded-full text-[15px] font-semibold"
        >
          {salvando ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </form>
  );
}
