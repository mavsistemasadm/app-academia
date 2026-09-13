"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function AceitarConvite({ familiarId }: { familiarId: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function aceitar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const limpo = codigo.trim().toUpperCase();
    if (limpo.length !== 6) {
      setErro("O código tem 6 caracteres.");
      return;
    }

    setSalvando(true);

    /*
      A policy `familiar_aceita_convite` só permite escrever numa linha
      pendente e sem dono, e obriga `familiar_id = auth.uid()`. Se o código
      não existir ou já tiver sido usado, o update afeta zero linhas — daí o
      `select` no retorno servir de confirmação.
    */
    const { data, error } = await createClient()
      .from("familiares_acesso")
      .update({
        familiar_id: familiarId,
        status: "ativo",
        aceito_em: new Date().toISOString(),
      })
      .eq("codigo", limpo)
      .eq("status", "pendente")
      .is("familiar_id", null)
      .select("id");

    setSalvando(false);

    if (error || !data?.length) {
      setErro("Código inválido ou já utilizado. Peça outro ao seu familiar.");
      return;
    }

    setCodigo("");
    router.refresh();
  }

  return (
    <form
      onSubmit={aceitar}
      className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-7"
      noValidate
    >
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
          Recebeu um código?
        </h2>
        <p className="mt-1 text-[15px] leading-relaxed text-neutral-500">
          Digite as 6 letras e números que seu familiar gerou no app dele.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="codigo" className="text-neutral-700">
          Código do convite
        </Label>
        <Input
          id="codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          disabled={salvando}
          className="numero h-16 rounded-[14px] px-4 text-center text-[28px] font-semibold tracking-[0.3em] placeholder:text-neutral-300 md:text-[28px]"
        />
      </div>

      {erro && (
        <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
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
            Validando...
          </>
        ) : (
          "Acompanhar"
        )}
      </Button>
    </form>
  );
}
