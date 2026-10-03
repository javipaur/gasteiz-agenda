import Link from "next/link";

export default function SectionHead({
  tag,
  title,
  subtitle,
  href,
  linkLabel = "Ver todo",
  color,
}: {
  tag?: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  color?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div>
        {tag && (
          <span
            className="inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full"
            style={{ backgroundColor: color ?? "var(--accent)", color: "var(--on-tint)" }}
          >
            {tag}
          </span>
        )}
        <h2 className="font-display text-2xl md:text-4xl font-black uppercase tracking-[-0.03em] text-fg leading-none mt-3">
          {title}
        </h2>
        {subtitle && <p className="text-fg-muted mt-2 text-sm">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-fg hover:text-accent transition-colors duration-300"
        >
          {linkLabel}
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </Link>
      )}
    </div>
  );
}