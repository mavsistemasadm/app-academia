"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

type Estado = "carregando" | "indisponivel" | "bloqueado" | "ativo" | "inativo";

/** A chave pública VAPID vem em base64url; o navegador quer bytes. */
function base64ParaBytes(base64: string): ArrayBuffer {
  const preenchido = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const normalizado = preenchido.replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(normalizado);

  const buffer = new ArrayBuffer(bruto.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);

  return buffer;
}

export function GerenciarNotificacoes() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);

  const chavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    async function verificar() {
      const suportado =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!suportado || !chavePublica) {
        setEstado("indisponivel");
        return;
      }

      if (Notification.permission === "denied") {
        setEstado("bloqueado");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const assinatura = await registro.pushManager.getSubscription();

      setEstado(assinatura ? "ativo" : "inativo");
    }

    verificar();
  }, [chavePublica]);

  async function ativar() {
    if (!chavePublica) return;

    setOcupado(true);

    const permissao = await Notification.requestPermission();

    if (permissao !== "granted") {
      setEstado(permissao === "denied" ? "bloqueado" : "inativo");
      setOcupado(false);
      return;
    }

    const registro = await navigator.serviceWorker.ready;

    const assinatura = await registro.pushManager.subscribe({
      // Sem isto o Chrome recusa a inscrição: toda mensagem tem que ser visível.
      userVisibleOnly: true,
      applicationServerKey: base64ParaBytes(chavePublica),
    });

    const resposta = await fetch("/api/push/inscrever", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assinatura: assinatura.toJSON() }),
    });

    setEstado(resposta.ok ? "ativo" : "inativo");
    setOcupado(false);
  }

  async function desativar() {
    setOcupado(true);

    const registro = await navigator.serviceWorker.ready;
    const assinatura = await registro.pushManager.getSubscription();

    await assinatura?.unsubscribe();
    await fetch("/api/push/inscrever", { method: "DELETE" });

    setEstado("inativo");
    setOcupado(false);
  }

  if (estado === "carregando" || estado === "indisponivel") return null;

  const ativo = estado === "ativo";
  const Icone = ativo ? Bell : BellOff;

  return (
    <div className="flex items-center gap-3.5 px-5 py-4">
      <Icone className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />

      <div className="min-w-0 flex-1">
        <p id="rotulo-lembretes" className="text-[15px] font-semibold text-neutral-950">
          Lembretes no celular
        </p>
        <p className="text-sm text-neutral-500">
          {ativo
            ? "Você recebe aviso de remédio, água e eventos."
            : estado === "bloqueado"
              ? "Bloqueados nas configurações do navegador. Libere por lá para ativar."
              : "Remédio na hora certa, água ao longo do dia e lembrete de evento."}
        </p>
      </div>

      {estado === "bloqueado" ? (
        <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500">
          Bloqueado
        </span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={ativo}
          aria-labelledby="rotulo-lembretes"
          onClick={ativo ? desativar : ativar}
          disabled={ocupado}
          className="flex h-12 shrink-0 items-center pl-2 disabled:opacity-60"
        >
          <span
            className={`relative flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-200 ${
              ativo ? "bg-grafite" : "bg-neutral-200"
            }`}
          >
            <span
              className={`flex size-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(12,18,20,.3)] transition-transform duration-200 ${
                ativo ? "translate-x-5" : "translate-x-0"
              }`}
            >
              {ocupado && (
                <Loader2 className="size-3.5 animate-spin text-neutral-500" aria-hidden />
              )}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
