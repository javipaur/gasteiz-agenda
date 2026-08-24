import Link from "next/link";
import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl border border-dashed border-border bg-surface/60">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-bg-muted text-fg-subtle flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <p className="font-display text-lg text-fg mb-1">{title}</p>
      {hint && <p className="text-sm text-fg-muted max-w-xs">{hint}</p>}
      {action && (
        <Link
          href={action.href}
          className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-300"
        >
          {action.label}
          <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </Link>
      )}
    </div>
  );
}
