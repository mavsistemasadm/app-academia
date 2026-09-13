"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AvatarCondicao, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_OPCOES } from "@/lib/utils/avatares";

/** 5 MB — foto de perfil não precisa de mais que isso. */
const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;

function formatarTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10)
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function FormularioPerfil({ perfil }: { perfil: Profile }) {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState(perfil.nome);
  const [telefone, setTelefone] = useState(
    formatarTelefone(perfil.telefone ?? "")
  );
  const [nascimento, setNascimento] = useState(perfil.data_nascimento ?? "");
  const [condicoes, setCondicoes] = useState<AvatarCondicao[]>(
    perfil.avatar_condicao ?? []
  );
  const [observacoes, setObservacoes] = useState(
    perfil.observacoes_clinicas ?? ""
  );
  const [familiarNome, setFamiliarNome] = useState(perfil.familiar_nome ?? "");
  const [familiarTelefone, setFamiliarTelefone] = useState(
    formatarTelefone(perfil.familiar_telefone ?? "")
  );
  const [medicoNome, setMedicoNome] = useState(perfil.medico_nome ?? "");
  const [medicoTelefone, setMedicoTelefone] = useState(
    formatarTelefone(perfil.medico_telefone ?? "")
  );
  const [fotoUrl, setFotoUrl] = useState(perfil.foto_url ?? "");

  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [, iniciarTransicao] = useTransition();

  async function enviarFoto(arquivo: File) {
    setErro(null);

    if (arquivo.size > TAMANHO_MAXIMO_FOTO) {
      setErro("A foto passa de 5 MB. Tente uma imagem menor.");
      return;
    }

    setEnviandoFoto(true);

    const extensao = arquivo.name.split(".").pop() ?? "jpg";
    // O primeiro nível do caminho precisa ser o próprio id (RLS do storage).
    const caminho = `${perfil.id}/perfil-${Date.now()}.${extensao}`;

    const { error } = await supabase.storage
      .from("avatares")
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });

    if (error) {
      setEnviandoFoto(false);
      setErro("Não conseguimos enviar a foto. Tente de novo.");
      return;
    }

    const { data } = supabase.storage.from("avatares").getPublicUrl(caminho);
    setFotoUrl(data.publicUrl);
    setEnviandoFoto(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSalvo(false);

    if (nome.trim().length < 3) {
      setErro("Digite seu nome completo.");
      return;
    }

    setSalvando(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, "") || null,
        data_nascimento: nascimento || null,
        avatar_condicao: condicoes.length > 0 ? condicoes : null,
        observacoes_clinicas: observacoes.trim() || null,
        familiar_nome: familiarNome.trim() || null,
        familiar_telefone: familiarTelefone.replace(/\D/g, "") || null,
        medico_nome: medicoNome.trim() || null,
        medico_telefone: medicoTelefone.replace(/\D/g, "") || null,
        foto_url: fotoUrl || null,
      })
      .eq("id", perfil.id);

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos salvar. Tente de novo.");
      return;
    }

    setSalvo(true);
    iniciarTransicao(() => router.refresh());
  }

  const inicial = nome.trim().charAt(0).toUpperCase() || "?";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* ── Foto ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
        <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-bold text-primary">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            inicial
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">Sua foto</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Ajuda o professor a reconhecer você na academia.
          </p>

          <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
            {enviandoFoto ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="size-4" aria-hidden />
            )}
            {fotoUrl ? "Trocar foto" : "Enviar foto"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={enviandoFoto || salvando}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) enviarFoto(arquivo);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* ── Dados pessoais ───────────────────────────────────────── */}
      <Secao titulo="Dados pessoais">
        <Campo id="nome" rotulo="Nome completo">
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={salvando}
            className="h-12 rounded-xl px-3.5 text-base"
          />
        </Campo>

        <Campo id="email" rotulo="E-mail">
          <Input
            id="email"
            value={perfil.email}
            readOnly
            disabled
            className="h-12 rounded-xl px-3.5 text-base"
          />
          <p className="text-xs text-neutral-500">
            Para trocar o e-mail, fale com o centro.
          </p>
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="telefone" rotulo="Telefone">
            <Input
              id="telefone"
              type="tel"
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(11) 98888-7777"
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </Campo>

          <Campo id="nascimento" rotulo="Data de nascimento">
            <Input
              id="nascimento"
              type="date"
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </Campo>
        </div>
      </Secao>

      {/* ── Saúde ────────────────────────────────────────────────── */}
      <Secao titulo="Saúde">
        <fieldset className="flex flex-col gap-2" disabled={salvando}>
          <legend className="mb-2 text-sm leading-none font-medium text-neutral-700">
            Condição clínica
          </legend>
          <div className="flex flex-wrap gap-2">
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
                  title={opcao.descricao}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                    marcada
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  )}
                >
                  <span className="text-base" aria-hidden>
                    {opcao.emoji}
                  </span>
                  {opcao.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Campo id="observacoes" rotulo="Observações clínicas">
          <textarea
            id="observacoes"
            rows={3}
            maxLength={600}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Algo que o professor precisa saber antes de montar seu treino."
            disabled={salvando}
            className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          />
        </Campo>
      </Secao>

      {/* ── Contatos ─────────────────────────────────────────────── */}
      <Secao
        titulo="Em caso de emergência"
        descricao="Quem o centro procura se algo acontecer durante o treino."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="familiar-nome" rotulo="Familiar">
            <Input
              id="familiar-nome"
              value={familiarNome}
              onChange={(e) => setFamiliarNome(e.target.value)}
              placeholder="Nome do familiar"
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </Campo>

          <Campo id="familiar-telefone" rotulo="Telefone do familiar">
            <Input
              id="familiar-telefone"
              type="tel"
              inputMode="tel"
              value={familiarTelefone}
              onChange={(e) =>
                setFamiliarTelefone(formatarTelefone(e.target.value))
              }
              placeholder="(11) 98888-7777"
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </Campo>

          <Campo id="medico-nome" rotulo="Médico">
            <Input
              id="medico-nome"
              value={medicoNome}
              onChange={(e) => setMedicoNome(e.target.value)}
              placeholder="Nome do médico"
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </Campo>

          <Campo id="medico-telefone" rotulo="Telefone do médico">
            <Input
              id="medico-telefone"
              type="tel"
              inputMode="tel"
              value={medicoTelefone}
              onChange={(e) =>
                setMedicoTelefone(formatarTelefone(e.target.value))
              }
              placeholder="(11) 3333-4444"
              disabled={salvando}
              className="h-12 rounded-xl px-3.5 text-base"
            />
          </Campo>
        </div>
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
          Perfil atualizado.
        </p>
      )}

      <Button
        type="submit"
        disabled={salvando || enviandoFoto}
        className="h-12 w-full rounded-xl text-base font-semibold"
      >
        {salvando ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Salvando...
          </>
        ) : (
          "Salvar perfil"
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

function Campo({
  id,
  rotulo,
  children,
}: {
  id: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-neutral-700">
        {rotulo}
      </Label>
      {children}
    </div>
  );
}
