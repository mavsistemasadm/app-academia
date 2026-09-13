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
  const condicoesMarcadas = AVATAR_OPCOES.filter((opcao) =>
    condicoes.includes(opcao.value)
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* ── Topo: foto, nome e condições ─────────────────────────── */}
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-card px-5 py-6 text-center ring-1 ring-neutral-200/90 sm:flex-row sm:items-center sm:gap-6 sm:text-left md:p-7">
        <div className="relative shrink-0">
          <span className="numero flex size-28 items-center justify-center overflow-hidden rounded-full bg-grafite text-4xl font-semibold text-white">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="" className="size-full object-cover" />
            ) : (
              inicial
            )}
          </span>

          <label
            className={cn(
              "absolute -right-1 -bottom-1 flex size-11 cursor-pointer items-center justify-center rounded-full bg-card text-neutral-700 shadow-[0_6px_18px_-8px_rgba(12,18,20,.45)] ring-1 ring-neutral-200 transition-all duration-200 hover:text-neutral-950 active:scale-[.98]",
              (enviandoFoto || salvando) && "pointer-events-none opacity-60"
            )}
          >
            {enviandoFoto ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Camera className="size-5" strokeWidth={1.8} aria-hidden />
            )}
            <span className="sr-only">{fotoUrl ? "Trocar foto" : "Enviar foto"}</span>
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

        <div className="flex min-w-0 flex-col items-center gap-2 sm:items-start">
          <h2 className="max-w-full truncate text-[24px] leading-tight font-semibold tracking-[-0.03em] text-neutral-950 md:text-[28px]">
            {nome.trim() || "Seu nome"}
          </h2>
          <p className="max-w-full truncate text-sm text-neutral-500">{perfil.email}</p>

          {condicoesMarcadas.length > 0 ? (
            <ul className="mt-1 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {condicoesMarcadas.map((opcao) => (
                <li
                  key={opcao.value}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-[13px] font-medium text-neutral-700"
                >
                  {opcao.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-neutral-400">
              Marque suas condições em Saúde, logo abaixo.
            </p>
          )}

          {!fotoUrl && (
            <p className="text-[13px] text-neutral-400">
              Uma foto ajuda o professor a reconhecer você na academia.
            </p>
          )}
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
            className={CLASSE_CAMPO}
          />
        </Campo>

        <Campo id="email" rotulo="E-mail">
          <Input
            id="email"
            value={perfil.email}
            readOnly
            disabled
            className={CLASSE_CAMPO}
          />
          <p className="text-[13px] text-neutral-400">
            Para trocar o e-mail, fale com o centro.
          </p>
        </Campo>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <Campo id="telefone" rotulo="Telefone">
            <Input
              id="telefone"
              type="tel"
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(11) 98888-7777"
              disabled={salvando}
              className={CLASSE_CAMPO}
            />
          </Campo>

          <Campo id="nascimento" rotulo="Data de nascimento">
            <Input
              id="nascimento"
              type="date"
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              disabled={salvando}
              className={CLASSE_CAMPO}
            />
          </Campo>
        </div>
      </Secao>

      {/* ── Saúde ────────────────────────────────────────────────── */}
      <Secao
        titulo="Saúde"
        descricao="É por aqui que o centro personaliza seu treino e seus indicadores."
      >
        <fieldset className="flex flex-col gap-2.5" disabled={salvando}>
          <legend className="mb-2.5 text-sm leading-none font-medium text-neutral-700">
            Condição clínica{" "}
            <span className="font-normal text-neutral-400">(marque quantas quiser)</span>
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
                    "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                    marcada
                      ? "bg-grafite text-white"
                      : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  <span className="text-base leading-none" aria-hidden>
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
            className="w-full resize-none rounded-[14px] border border-input bg-card px-4 py-3 text-base transition-colors outline-none placeholder:text-neutral-400 hover:border-neutral-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          />
        </Campo>
      </Secao>

      {/* ── Contatos ─────────────────────────────────────────────── */}
      <Secao
        titulo="Em caso de emergência"
        descricao="Quem o centro procura se algo acontecer durante o treino."
      >
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <Campo id="familiar-nome" rotulo="Familiar">
            <Input
              id="familiar-nome"
              value={familiarNome}
              onChange={(e) => setFamiliarNome(e.target.value)}
              placeholder="Nome do familiar"
              disabled={salvando}
              className={CLASSE_CAMPO}
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
              className={CLASSE_CAMPO}
            />
          </Campo>

          <Campo id="medico-nome" rotulo="Médico">
            <Input
              id="medico-nome"
              value={medicoNome}
              onChange={(e) => setMedicoNome(e.target.value)}
              placeholder="Nome do médico"
              disabled={salvando}
              className={CLASSE_CAMPO}
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
              className={CLASSE_CAMPO}
            />
          </Campo>
        </div>
      </Secao>

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
        <Button
          type="submit"
          disabled={salvando || enviandoFoto}
          className="h-12 w-full rounded-full px-8 text-base font-semibold sm:w-auto"
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

        {erro && (
          <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {erro}
          </p>
        )}

        {salvo && !erro && (
          <p role="status" className="flex items-center gap-2 text-sm text-saude-verde">
            <Check className="size-4 shrink-0" aria-hidden />
            Perfil atualizado.
          </p>
        )}
      </div>
    </form>
  );
}

const CLASSE_CAMPO = "h-12 rounded-[14px] px-4 text-base";

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
    <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-7">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
          {titulo}
        </h2>
        {descricao && (
          <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">{descricao}</p>
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
