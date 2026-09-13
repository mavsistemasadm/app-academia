"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

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
      {medicamentos.length > 0 && (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {medicamentos.map((medicamento) => (
            <li key={medicamento.id} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-semibold",
                    medicamento.ativo ? "text-neutral-900" : "text-neutral-400"
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
                <p className="truncate text-xs text-neutral-500">
                  {(medicamento.horarios ?? [])
                    .map((h) => h.slice(0, 5))
                    .join(" · ") || "Sem horário"}
                  {medicamento.dias_semana?.length
                    ? ` · ${medicamento.dias_semana.length} dias/semana`
                    : " · todos os dias"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => alternarAtivo(medicamento)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
                  medicamento.ativo
                    ? "bg-saude-verde-light text-saude-verde"
                    : "bg-neutral-100 text-neutral-500"
                )}
              >
                {medicamento.ativo ? "Ativo" : "Pausado"}
              </button>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setEmEdicao(medicamento)}
                aria-label={`Editar ${medicamento.nome}`}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => setCriando(true)}
        className="h-12 rounded-xl font-semibold"
      >
        <Plus className="size-5" aria-hidden />
        Cadastrar medicamento
      </Button>

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
      <DialogContent className="sm:max-w-md">
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
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>
          {medicamento ? "Editar medicamento" : "Novo medicamento"}
        </DialogTitle>
        <DialogDescription>
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
          className="h-12 rounded-xl px-3.5 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="med-dose" className="text-neutral-700">
            Dose
          </Label>
          <Input
            id="med-dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="850 mg"
            disabled={salvando}
            className="h-12 rounded-xl px-3.5 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="med-condicao" className="text-neutral-700">
            Para quê
          </Label>
          <Input
            id="med-condicao"
            value={condicao}
            onChange={(e) => setCondicao(e.target.value)}
            placeholder="Diabetes"
            disabled={salvando}
            className="h-12 rounded-xl px-3.5 text-base"
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2" disabled={salvando}>
        <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
          Horários
        </legend>

        <div className="flex flex-col gap-2">
          {horarios.map((horario, indice) => (
            <div key={indice} className="flex gap-2">
              <Input
                type="time"
                value={horario}
                onChange={(e) =>
                  setHorarios((atuais) =>
                    atuais.map((h, i) => (i === indice ? e.target.value : h))
                  )
                }
                aria-label={`Horário ${indice + 1}`}
                className="h-12 flex-1 rounded-xl px-3.5 text-base"
              />
              {horarios.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setHorarios((atuais) =>
                      atuais.filter((_, i) => i !== indice)
                    )
                  }
                  aria-label={`Remover horário ${indice + 1}`}
                  className="size-12 shrink-0 text-neutral-400"
                >
                  <X className="size-5" aria-hidden />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setHorarios((atuais) => [...atuais, "20:00"])}
          className="h-11 rounded-xl"
        >
          <Plus className="size-4" aria-hidden />
          Outro horário
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-2" disabled={salvando}>
        <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
          Dias{" "}
          <span className="font-normal text-neutral-400">
            (vazio = todos os dias)
          </span>
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
                    marcado ? atuais.filter((d) => d !== dia) : [...atuais, dia]
                  )
                }
                aria-pressed={marcado}
                className={cn(
                  "size-11 rounded-xl border text-sm font-medium transition-colors",
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
      </fieldset>

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-saude-vermelho-light px-3.5 py-3 text-sm text-saude-vermelho"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
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
            className="h-12 w-12 shrink-0 rounded-xl text-saude-vermelho"
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
          className="h-12 flex-1 rounded-xl text-base font-semibold"
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
