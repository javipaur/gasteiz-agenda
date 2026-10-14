"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  useInstallPrompt,
  promptInstall,
  useInstalado,
} from "@/lib/useInstallPrompt";
import {
  metodoDeInstalacion,
  muestraAppNativa,
  type EntradaInstalacion,
  type MetodoInstalacion,
} from "@/lib/install";

const PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick";

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
    </svg>
  );
}

/** El icono de Compartir de iOS. Es un icono, no una imitación de la hoja. */
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10H5.5A1.5 1.5 0 004 11.5v7A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0018.5 10H16" />
      <path d="M12 16V4" />
      <path d="M8.5 7.5L12 4l3.5 3.5" />
    </svg>
  );
}

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="currentColor">
      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
    </svg>
  );
}

/**
 * `userAgent` y `maxTouchPoints` son primitivos a propósito.
 *
 * `useSyncExternalStore` compara el valor nuevo con el anterior con `Object.is`,
 * así que devolver un objeto nuevo en cada lectura repinta en bucle. Dos
 * `useSyncExternalStore` que devuelven `string` y `number` no tienen ese problema.
 *
 * En servidor los dos dan `""` y `0`, que es un iPhone falso: el resultado es
 * `instrucciones-genericas`, y no `instrucciones-ios`. Importa que el `getServerSnapshot`
 * sea el mismo en el servidor y en la hidratación, que es lo que evita el aviso
 * de desajuste; lo que se vea los primeros milisegundos en iOS da igual porque
 * se corrige en cuanto hidrata.
 */
const NUNCA_CAMBIA = () => () => {};
const SIN_USER_AGENT = () => "";

function usePlataforma(): Pick<EntradaInstalacion, "userAgent" | "maxTouchPoints"> {
  return {
    userAgent: useSyncExternalStore(
      NUNCA_CAMBIA,
      () => navigator.userAgent,
      SIN_USER_AGENT
    ),
    maxTouchPoints: useSyncExternalStore(
      NUNCA_CAMBIA,
      () => navigator.maxTouchPoints,
      () => 0
    ),
  };
}

/**
 * Lo que pasó en el último intento.
 *
 * Existe por un fallo concreto. `prompt()` consume el evento en cuanto se
 * pulsa, así que en cuanto la persona toca «Instalar», `eventoDisponible` pasa
 * a `false` y el método derivado se degrada a `instrucciones-genericas`: el
 * botón se convertiría al instante en "este navegador no instala esto" con el
 * diálogo del navegador todavía delante. El estado del intento es lo que
 * sostiene la pantalla correcta hasta que hay una respuesta.
 */
type Intento = "reposo" | "pidiendo" | "instalada" | "descartado";

export default function InstallGuide() {
  const instaladoPorDisplay = useInstalado();
  const eventoDisponible = useInstallPrompt();
  const { userAgent, maxTouchPoints } = usePlataforma();
  const [intento, setIntento] = useState<Intento>("reposo");

  // `accepted` es el propio navegador diciendo que la PWA está instalada, así
  // que se cree sin esperar a que `display-mode` cambie. Esperar al `matchMedia`
  // dejaría un hueco en el que se vería la rama equivocada.
  const instalado = instaladoPorDisplay || intento === "instalada";

  const entrada: EntradaInstalacion = {
    userAgent,
    maxTouchPoints,
    instalado,
    eventoDisponible,
  };

  const metodo: MetodoInstalacion | Intento = instalado
    ? "ya-instalada"
    : intento === "reposo"
      ? metodoDeInstalacion(entrada)
      : intento;

  const handleInstall = async () => {
    setIntento("pidiendo");
    const resultado = await promptInstall();
    setIntento(resultado === "accepted" ? "instalada" : "descartado");
  };

  if (metodo === "ya-instalada") {
    return (
      <Tarjeta>
        <h2 className="font-display text-xl md:text-2xl font-semibold text-fg tracking-[-0.01em]">
          Ya la tienes en la pantalla de inicio
        </h2>
        <p className="text-fg-muted leading-relaxed">
          Gasteiz Click se abre desde ahí, sin barra de navegador, y las páginas
          que ya visitaste siguen disponibles sin conexión.
        </p>
      </Tarjeta>
    );
  }

  if (metodo === "instrucciones-ios") {
    return (
      <Tarjeta>
        <h2 className="font-display text-xl md:text-2xl font-semibold text-fg tracking-[-0.01em] mb-2">
          Añádela a tu pantalla de inicio
        </h2>
        <p className="text-fg-muted leading-relaxed mb-6">
          En iPhone y iPad la instalación la haces tú desde el menú de Safari.
          Safari no deja que una web se instale sola, y no hace falta instalar
          nada: solo dejar un icono.
        </p>
        <ol className="flex flex-col gap-4">
          <Paso numero={1} icono={<ShareIcon className="w-5 h-5" />}>
            Toca <strong className="text-fg">Compartir</strong>, el botón con
            la caja y la flecha hacia arriba de la barra de abajo.
          </Paso>
          <Paso numero={2}>
            Baja por la hoja hasta{" "}
            <strong className="text-fg">Añadir a pantalla de inicio</strong>.
          </Paso>
          <Paso numero={3}>
            Toca <strong className="text-fg">Añadir</strong>, arriba a la
            derecha.
          </Paso>
        </ol>
        <p className="text-fg-muted text-sm leading-relaxed mt-6 pt-6 border-t border-border">
          A partir de entonces Gasteiz Click se abre como cualquier otra app y
          sigue funcionando cuando no hay cobertura.
        </p>
      </Tarjeta>
    );
  }

  if (metodo === "pidiendo") {
    return (
      <Tarjeta>
        <h2 className="font-display text-xl md:text-2xl font-semibold text-fg tracking-[-0.01em]">
          Confirma en la ventana del navegador
        </h2>
        <p className="text-fg-muted leading-relaxed">
          El diálogo de instalación es el del navegador, no esta página. Toca
          «Instalar» y en un momento estará en tu pantalla de inicio.
        </p>
      </Tarjeta>
    );
  }

  if (metodo === "descartado") {
    return (
      <Tarjeta>
        <h2 className="font-display text-xl md:text-2xl font-semibold text-fg tracking-[-0.01em]">
          Has cancelado la instalación
        </h2>
        <p className="text-fg-muted leading-relaxed">
          No pasa nada. Puedes volver a intentarlo desde aquí cuando quieras, o
          crear el acceso a mano desde el menú del navegador.
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <h2 className="font-display text-xl md:text-2xl font-semibold text-fg tracking-[-0.01em] mb-2">
        {metodo === "navegador" ? "Instala Gasteiz Click" : "Crea un acceso directo"}
      </h2>
      <p className="text-fg-muted leading-relaxed mb-6">
        {metodo === "navegador" ? (
          <>
            Un icono en tu pantalla de inicio, sin barra de navegador, y las
            páginas que ya visitaste disponibles sin conexión.
          </>
        ) : (
          <>
            Este navegador no instala la web como si fuera una app. Puedes
            dejarla igual de accesible desde su menú: busca «Añadir a la
            pantalla de inicio» o «Instalar».
          </>
        )}
      </p>

      {metodo === "navegador" && (
        <button
          type="button"
          onClick={() => void handleInstall()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-all duration-300 active:scale-[0.98] min-h-[44px]"
        >
          <DownloadIcon className="w-4 h-4" />
          Instalar
        </button>
      )}

      {/* El relleno va en la parte estática del `className` y no dentro del ternario.
          Además de que Tailwind lo vea igual, `__tests__/components/touch-targets.test.ts`
          lee el fichero en crudo y descarta lo que sale de una interpolación: con el
          relleno dentro del ternario, el enlace mediría 20×20 —la altura del texto— y
          saltaría un rojo que no existe. */}
      {muestraAppNativa(entrada) && (
        <a
          href={PLAY_STORE}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-full text-sm transition-all duration-300 ${
            metodo === "navegador"
              ? "mt-3 ml-3 bg-white/10 hover:bg-white/20 text-fg"
              : "bg-bg-muted text-fg-muted hover:text-fg"
          }`}
        >
          <PlayStoreIcon className="w-4 h-4" />
          O usa la app de Google Play
        </a>
      )}
    </Tarjeta>
  );
}

function Tarjeta({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[1.25rem] border border-border bg-bg-elevated p-6 md:p-8">
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function Paso({
  numero,
  icono,
  children,
}: {
  numero: number;
  icono?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="shrink-0 w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
        {icono ?? <span className="text-sm font-semibold tabular-nums">{numero}</span>}
      </span>
      <span className="text-fg-muted leading-relaxed pt-1.5">{children}</span>
    </li>
  );
}