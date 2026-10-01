"use client";

import { useState } from "react";
import { useInstallPrompt, promptInstall } from "@/lib/useInstallPrompt";

const STORAGE_KEY = "gasteiz-install-dismissed";
const REAPARICION_MS = 72 * 60 * 60 * 1000;

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 5l10 10M15 5l-10 10" />
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
 * Si se descartó hace menos de 72 horas, el banner no vuelve a salir.
 *
 * Se lee al montar y no en un efecto: durante el render del servidor
 * `localStorage` no existe, y `useInstallPrompt()` devuelve `false` en servidor,
 * así que el banner no se pinta nunca en SSR y no hay desajuste de hidratación
 * que un efecto tuviera que tapar.
 */
function descartadoReciente(): boolean {
  if (typeof window === "undefined") return false;
  const descartadoAt = Number(localStorage.getItem(STORAGE_KEY));
  return descartadoAt > 0 && Date.now() - descartadoAt < REAPARICION_MS;
}

export default function InstallBanner() {
  const disponible = useInstallPrompt();
  const [descartado, setDescartado] = useState(descartadoReciente);

  const handleInstall = async () => {
    await promptInstall();
  };

  const handleDismiss = () => {
    setDescartado(true);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  };

  if (!disponible || descartado) return null;

  return (
    <section className="px-5 sm:px-6 py-8 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-[1.25rem] bg-fg text-white p-6 md:p-8">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shrink-0">
            <DownloadIcon className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1">
            <h3 className="font-display text-lg md:text-xl font-semibold text-white mb-1">
              Instala Gasteiz Click
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Acceso directo desde tu pantalla de inicio. Sin abrir el navegador, sin buscar la web.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleInstall}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-all duration-300 active:scale-[0.98]"
            >
              <DownloadIcon className="w-4 h-4" />
              Instalar
            </button>

            <a
              href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition-all duration-300"
            >
              <PlayStoreIcon className="w-4 h-4" />
              Google Play
            </a>

            <button
              onClick={handleDismiss}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
              aria-label="Cerrar"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
