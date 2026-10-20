"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "gasteiz-theme";
const EVENT = "gasteiz-theme-change";
type Choice = "auto" | "light" | "dark";

function SystemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
      <path d="M6.5 16.5h7M10 13.5v3" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M16 4l-1.4 1.4M5.4 14.6L4 16M16 16l-1.4-1.4M5.4 5.4L4 4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 12.5A7.5 7.5 0 017.5 3a7.5 7.5 0 109.5 9.5z" />
    </svg>
  );
}

function subscribe(onChange: () => void) {
  // El `onChange` repinta el botón, pero el atributo del `<html>` lo tiene que
  // escribir quien escucha: si otra pestaña cambia el tema, esta se entera por
  // el evento `storage` y repinta el control, pero el color de la página se
  // queda como estaba.
  const alCambiar = () => {
    aplicarEleccion();
    onChange();
  };
  window.addEventListener(EVENT, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENT, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/**
 * Escribe el atributo que decide la paleta, a partir de lo que hay guardado.
 *
 * Los tres estados:
 * - `"dark"` / `"light"`: lo que eligió la persona.
 * - `"auto"`: **sin atributo**, que es lo que deja que la media query de
 *   `globals.css` decida, y con ella el sistema operativo.
 * - Nada guardado: el valor por defecto del sitio, que es claro.
 *
 * Está en una función y no en el `onClick` porque tiene que passar por aquí
 * también el cambio hecho en **otra** pestaña: el evento `storage` avisa, pero
 * el atributo del `<html>` de esta pestaña hay que escribirlo a mano.
 */
function aplicarEleccion(): void {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
    } else if (stored === "auto") {
      // Sin atributo, no con atributo vacío: `:root:not([data-theme="dark"])`
      // es la regla que aplica la paleta clara cuando el sistema es claro, y un
      // atributo vacío seguiría casando con ella pero rompería el "auto" en
      // cuanto el sistema fuera oscuro.
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch {}
}

function getSnapshot(): Choice {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "auto") return stored;
  } catch {}
  // El defecto del sitio es el tema claro, así que lo que no ha elegido nadie
  // es claro. Antes devolvía `"auto"` y el botón decía "Tema del sistema"
  // mientras la página estaba en claro: el control mentía.
  return "light";
}

function getServerSnapshot(): Choice {
  return "light";
}

export default function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const pick = useCallback((next: Choice) => {
    try {
      // Se **guarda** la elección, también la de "auto". Antes se borraba la
      // clave, y eso hacía que "auto" y "nunca he elegido" fueran lo mismo: la
      // elección se perdía al recargar y la página volvía a claro.
      localStorage.setItem(KEY, next);
    } catch {}
    aplicarEleccion();
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const options: { value: Choice; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
    { value: "auto", label: "Tema del sistema", Icon: SystemIcon },
    { value: "light", label: "Tema claro", Icon: SunIcon },
    { value: "dark", label: "Tema oscuro", Icon: MoonIcon },
  ];

  return (
    <div
      role="group"
      aria-label="Seleccionar tema"
      className="inline-flex items-center rounded-full bg-white/10"
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => pick(value)}
          aria-label={label}
          aria-pressed={choice === value}
          title={label}
          // `min-w/min-h-[44px]` y no `w-8 h-7`: eran 32×28, el control más
          // pequeño del repo y el que más cuesta de acertar con el pulgar — y
          // elegir el tema equivocado se nota, porque cambia la luz de toda la
          // página. El relleno `p-1` del grupo y el `gap-0.5` se han ido con él:
          // a 44 px por botón los tres ocupan 132 y el `gap` sólo añadía hueco.
          // `rounded-full` sobre el grupo, en vez de sobre cada botón, mantiene
          // la cápsula sin bordes dobles en los extremos.
          className={`flex items-center justify-center min-w-[44px] min-h-[44px] transition-colors duration-300 cursor-pointer ${
            choice === value
              ? "rounded-full bg-white/20 text-white"
              : "rounded-full text-white/40 hover:text-white/70 hover:bg-white/5"
          }`}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
