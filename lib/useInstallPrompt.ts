"use client";

import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", ((event: BeforeInstallPromptEvent) => {
    event.preventDefault();
    deferredPrompt = event;
    emit();
  }) as EventListener);
}

export function useInstallPrompt(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot() !== null,
    () => false,
  );
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") {
    deferredPrompt = null;
    emit();
  }
  return outcome;
}
