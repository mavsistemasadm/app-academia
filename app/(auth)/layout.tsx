import Image from "next/image";
import { Activity, Dumbbell, HeartHandshake, ShieldCheck } from "lucide-react";

/*
  Tela dividida: marca e proposta à esquerda, acesso à direita. No celular
  empilha — título curto em cima, card logo abaixo.

  As cores saem da logo (grafite, cinza e ciano) e valem só aqui: o
  `--primary` é trocado neste wrapper, então botão, link e foco das quatro
  telas de acesso ficam ciano sem mexer no azul do resto do app.
*/

const DESTAQUES = [
  { icone: Dumbbell, texto: "Treino do dia, série a série, com vídeo" },
  { icone: Activity, texto: "Pressão, glicemia e remédios no semáforo" },
  { icone: HeartHandshake, texto: "Seu professor avisado quando algo foge do normal" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-1 overflow-hidden bg-[#07090a] text-white [--primary:#0a9db2] [--ring:#0a9db2]">
      {/* Fundo: brilho ciano e grafite + o pulso da marca em marca-d'água. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(0,180,203,.16),transparent_38%),radial-gradient(circle_at_90%_95%,rgba(92,100,102,.22),transparent_42%),linear-gradient(135deg,#07090a_0%,#0c1112_45%,#111a1c_100%)]"
      />
      <Image
        src="/marca/simbolo.png"
        alt=""
        aria-hidden
        width={512}
        height={512}
        className="pointer-events-none absolute -bottom-24 -left-24 hidden w-[520px] -rotate-6 opacity-[0.04] select-none lg:block"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl content-center items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_460px] lg:gap-16 lg:px-10">
        {/* ── Esquerda: marca e proposta ─────────────────────────────── */}
        <section className="flex flex-col items-center text-center lg:items-start lg:pl-4 lg:text-left">
          <Image
            src="/marca/logo.png"
            alt="Atitude Vital — centro de treinamento"
            width={1000}
            height={336}
            priority
            sizes="(min-width: 1024px) 224px, 176px"
            className="mb-8 h-auto w-44 lg:mb-10 lg:w-56"
          />

          <div className="mb-5 hidden items-center gap-2.5 rounded-full border border-white/10 bg-white/[.03] px-4 py-2 text-xs text-white/70 backdrop-blur lg:inline-flex">
            <span className="size-2 rounded-full bg-[#00b4cb] shadow-[0_0_14px_#00b4cb]" />
            Central de Saúde Conectada
          </div>

          <h1 className="max-w-xl text-3xl leading-[1.05] font-bold tracking-tight sm:text-4xl lg:text-6xl lg:tracking-[-0.04em]">
            Seu treino e sua saúde, cuidados{" "}
            <span className="text-[#00b4cb]">todos os dias.</span>
          </h1>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55 lg:mt-6 lg:max-w-lg lg:text-lg">
            O centro acompanha você entre um treino e outro — indicadores,
            remédios, humor e evolução num lugar só.
          </p>

          <ul className="mt-10 hidden flex-col gap-4 lg:flex">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-[15px] text-white/75">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-[#00b4cb]">
                  <Icone className="size-5" aria-hidden />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Direita: acesso ────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-md lg:max-w-none">
          <div className="[&_[data-slot=card]]:rounded-3xl [&_[data-slot=card]]:shadow-[0_24px_80px_rgba(0,0,0,.5)] [&_[data-slot=card]]:ring-1 [&_[data-slot=card]]:ring-white/10">
            {children}
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-white/40">
            <ShieldCheck className="size-3.5" aria-hidden />
            Seus dados de saúde são privados e protegidos.
          </p>
          <p className="mt-1 text-center text-xs text-white/25">
            © {new Date().getFullYear()} Atitude Vital · centro de treinamento
          </p>
        </section>
      </div>
    </div>
  );
}
