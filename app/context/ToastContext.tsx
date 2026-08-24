"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";

type ToastAction = { href: string; label: string };
type Toast = { id: number; message: string; action?: ToastAction };

const ToastContext = createContext<{
  showToast: (message: string, action?: ToastAction) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    setToast({ id: Date.now(), message, action });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-live="polite" aria-atomic="true">
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="toast-in fixed left-1/2 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] md:bottom-6 z-[var(--z-toast)] flex items-center gap-3 bg-fg text-bg rounded-full pl-5 pr-3 py-3 shadow-lg max-w-[calc(100vw-2.5rem)]"
            style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5l3.5 3.5L13 5" />
            </svg>
            <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
              {toast.message}
            </span>
            {toast.action && (
              <Link
                href={toast.action.href}
                onClick={() => setToast(null)}
                className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] underline underline-offset-4 decoration-current/40 hover:opacity-80 transition-opacity duration-200 whitespace-nowrap"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {toast.action.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
