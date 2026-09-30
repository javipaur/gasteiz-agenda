import type { Metadata } from "next";
import Link from "next/link";
import {
  Music2,
  Clapperboard,
  Palette,
  Film,
  Trophy,
  PartyPopper,
  Baby,
  Mail,
  Star,
  Gift,
  LogOut,
  ArrowRight,
} from "lucide-react";
import { LogoMark } from "@/app/components/LogoMark";
import SubscribeForm from "@/app/components/SubscribeForm";

export const metadata: Metadata = {
  title: "Suscríbete a la newsletter · Gasteiz Click",
  description:
    "Recibe cada semana, en un solo email, los mejores planes de Vitoria-Gasteiz: conciertos, teatro, exposiciones, cine, deporte y planes familiares. Gratis y sin spam.",
  alternates: { canonical: "/suscribete" },
};

const CATEGORIAS = [
  { nombre: "Conciertos", icono: Music2 },
  { nombre: "Teatro", icono: Clapperboard },
  { nombre: "Exposiciones", icono: Palette },
  { nombre: "Cine", icono: Film },
  { nombre: "Deporte", icono: Trophy },
  { nombre: "Fiestas y festivales", icono: PartyPopper },
  { nombre: "Planes familiares", icono: Baby },
];

const BENEFICIOS = [
  {
    titulo: "Curado a mano",
    texto: "Seleccionamos lo mejor de cada semana. Nada de ruido: solo planes que merecen la pena.",
    icono: Star,
  },
  {
    titulo: "Un email a la semana",
    texto: "Llega a tu buzón con tiempo para decidir. Léelo en dos minutos y sigue el día.",
    icono: Mail,
  },
  {
    titulo: "Gratis para siempre",
    texto: "La agenda es libre y la newsletter también. Solo necesitas tu correo.",
    icono: Gift,
  },
  {
    titulo: "Baja en un clic",
    texto: "Cada email incluye un enlace para darte de baja. Sin preguntas, sin letra pequeña.",
    icono: LogOut,
  },
];

export default function SuscribetePage() {
  return (
    <article className="px-5 sm:px-6 pt-28 md:pt-32 pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="flex items-center gap-2 mb-6">
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
            <span className="font-display italic text-accent text-sm">
              Newsletter semanal · Gasteiz Click
            </span>
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
          </div>

          <div className="mx-auto w-28 h-28 rounded-full bg-brand-bone flex items-center justify-center text-brand-ink shadow-lg mb-8">
            <LogoMark className="w-16 h-16" spiral="var(--color-brand-red)" />
          </div>

          <h1 className="font-display text-3xl md:text-5xl text-fg font-semibold tracking-[-0.03em] leading-[1.05] mb-6 max-w-3xl">
            Los mejores planes de Vitoria-Gasteiz,{" "}
            <span className="text-accent">cada semana</span> en tu correo
          </h1>
          <p className="text-base md:text-lg text-fg-muted leading-relaxed mb-4 max-w-2xl">
            Cada semana recopilamos lo mejor de la agenda: conciertos, teatro,
            exposiciones, cine, deporte y planes familiares. Curado a mano, sin
            ruido y gratis.
          </p>
        </div>

        <div className="max-w-5xl mx-auto mb-14">
          <SubscribeForm />
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-16">
          {BENEFICIOS.map(({ titulo, texto, icono: Icono }) => (
            <div
              key={titulo}
              className="rounded-2xl bg-bg-elevated border border-border p-6"
            >
              <span className="inline-flex w-10 h-10 rounded-xl bg-accent-subtle text-accent items-center justify-center mb-4">
                <Icono className="w-5 h-5" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg text-fg font-semibold tracking-[-0.01em] mb-2">
                {titulo}
              </h2>
              <p className="text-sm text-fg-muted leading-relaxed">{texto}</p>
            </div>
          ))}
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
            <h2 className="font-display italic text-accent text-sm">
              Lo que encuentras cada semana
            </h2>
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {CATEGORIAS.map(({ nombre, icono: Icono }) => (
              <span
                key={nombre}
                className="inline-flex items-center gap-2 rounded-full bg-accent-subtle text-fg border border-border px-4 py-2 text-sm font-medium"
              >
                <Icono className="w-4 h-4 text-accent" aria-hidden="true" />
                {nombre}
              </span>
            ))}
          </div>
        </section>

        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-fg-muted leading-relaxed mb-4">
            Usamos doble opt-in: te enviamos un email de confirmación antes de
            suscribirte. Tu correo solo se usa para la newsletter, tratado según
            la{" "}
            <Link
              href="/privacidad"
              className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
            >
              política de privacidad
            </Link>
            . Puedes darte de baja cuando quieras.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-accent hover:text-accent-hover font-semibold text-sm transition-colors duration-300"
          >
            Volver a la agenda
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}