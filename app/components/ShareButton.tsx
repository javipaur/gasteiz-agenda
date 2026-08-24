"use client";

import { useCallback } from "react";

export default function ShareButton({
  title,
  slug,
  location,
}: {
  title: string;
  slug: string;
  location?: string;
}) {
  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/evento/${slug}`;
    const shareData = {
      title,
      text: `${title}${location ? ` en ${location}` : ""}`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    }
  }, [title, slug, location]);

  return (
    <button
      onClick={handleShare}
      aria-label="Compartir evento"
      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-border bg-surface text-sm font-medium text-fg-muted hover:text-fg hover:border-border-hover transition-all duration-300 active:scale-[0.98] cursor-pointer"
    >
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 7a3 3 0 100-6 3 3 0 000 6zM5 13a3 3 0 100-6 3 3 0 000 6zM15 19a3 3 0 100-6 3 3 0 000 6zM7.59 11.51l4.83 2.98M12.41 11.51L7.59 8.53" />
      </svg>
      Compartir
    </button>
  );
}
