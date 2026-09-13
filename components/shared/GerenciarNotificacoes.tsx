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

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
          estado === "ativo"
            ? "bg-saude-verde-light text-saude-verde"
            : "bg-neutral-100 text-neutral-400"
        }`}
      >
        {estado === "ativo" ? (
          <Bell className="size-5" aria-hidden />
        ) : (
          <BellOff className="size-5" aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">
          Lembretes no celular
        </p>
        <p className="text-xs text-neutral-500">
          {estado === "ativo"
            ? "Você recebe aviso de remédio, água e eventos."
            : estado === "bloqueado"
              ? "As notificações estão bloqueadas nas configurações do navegador."
              : "Remédio na hora certa, água ao longo do dia e lembrete de evento."}
        </p>
      </div>

      {estado !== "bloqueado" && (
        <button
          type="button"
          onClick={estado === "ativo" ? desativar : ativar}
          disabled={ocupado}
          className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors ${
            estado === "ativo"
              ? "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              : "bg-primary text-white hover:opacity-90"
          }`}
        >
          {ocupado && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {estado === "ativo" ? "Desativar" : "Ativar"}
        </button>
      )}
    </div>
  );
}
