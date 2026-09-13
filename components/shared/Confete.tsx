"use client";

import { useEffect, useRef } from "react";

const CORES = ["#00B4CB", "#0A8FA3", "#5FD3E2", "#16A34A", "#FFFFFF", "#F5B942"];

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  velocidadeGiro: number;
  largura: number;
  altura: number;
  cor: string;
  redonda: boolean;
}

/**
 * Explosão de confete em canvas, sem biblioteca. Dispara uma vez ao montar e
 * some sozinha em ~3s. Quem pediu movimento reduzido no sistema não vê nada.
 */
export function Confete({ duracao = 3000 }: { duracao?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const escala = window.devicePixelRatio || 1;
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    ctx.scale(escala, escala);

    // Dois jatos saindo de baixo, dos cantos, em direção ao centro.
    const particulas: Particula[] = Array.from({ length: 160 }, (_, i) => {
      const daEsquerda = i % 2 === 0;
      const angulo = (daEsquerda ? -60 : -120) + (Math.random() - 0.5) * 50;
      const forca = 9 + Math.random() * 11;
      return {
        x: daEsquerda ? largura * 0.1 : largura * 0.9,
        y: altura * 0.95,
        vx: Math.cos((angulo * Math.PI) / 180) * forca,
        vy: Math.sin((angulo * Math.PI) / 180) * forca,
        giro: Math.random() * Math.PI,
        velocidadeGiro: (Math.random() - 0.5) * 0.3,
        largura: 6 + Math.random() * 6,
        altura: 8 + Math.random() * 8,
        cor: CORES[Math.floor(Math.random() * CORES.length)],
        redonda: Math.random() < 0.3,
      };
    });

    const inicio = performance.now();
    let quadro = 0;

    function desenhar(agora: number) {
      const passado = agora - inicio;
      ctx!.clearRect(0, 0, largura, altura);
      const opacidade = passado > duracao - 600 ? Math.max(0, (duracao - passado) / 600) : 1;

      for (const p of particulas) {
        p.vy += 0.28; // gravidade
        p.vx *= 0.985; // resistência do ar
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.giro += p.velocidadeGiro;

        ctx!.save();
        ctx!.globalAlpha = opacidade;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.giro);
        ctx!.fillStyle = p.cor;
        if (p.redonda) {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.largura / 2, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          // Achatar com o giro dá a impressão de papel virando.
          ctx!.fillRect(-p.largura / 2, -p.altura / 2, p.largura, p.altura * Math.abs(Math.cos(p.giro)));
        }
        ctx!.restore();
      }

      if (passado < duracao) quadro = requestAnimationFrame(desenhar);
    }

    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [duracao]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80] size-full"
    />
  );
}
