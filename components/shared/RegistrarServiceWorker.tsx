"use client";

import { useEffect } from "react";

/**
 * Registra o service worker uma vez, depois que a página carregou — antes
 * disso ele competiria por banda com o que o aluno veio ver.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Sem service worker o app continua funcionando — só não instala
        // nem recebe push. Não vale interromper o aluno por isso.
      });
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
