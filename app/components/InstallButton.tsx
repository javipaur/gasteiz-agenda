"use client";

import { useInstallPrompt, promptInstall } from "@/lib/useInstallPrompt";

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
    </svg>
  );
}

export function InstallButton() {
  const available = useInstallPrompt();

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={() => void promptInstall()}
      className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] px-4 py-3 rounded-xl text-sm text-white/70 cursor-pointer"
    >
      <DownloadIcon className="w-5 h-5 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] text-white/40 uppercase tracking-[0.1em]">Desde el navegador</span>
        <span className="font-semibold text-white/70">Instalar como app</span>
      </span>
    </button>
  );
}