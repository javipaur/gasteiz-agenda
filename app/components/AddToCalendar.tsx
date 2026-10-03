"use client";

type Props = {
  title: string;
  date: string;
  dateEnd?: string;
  time?: string;
  location: string;
  slug: string;
};

function madridOffsetMs(d: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(d);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asUtc - d.getTime();
}

function parseTime(time?: string): string {
  const m = (time || "").match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return "18:00";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Instante UTC correspondiente a esa fecha+hora local de Madrid */
function toUtc(dateStr: string, hhmm: string): Date | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, da] = m.map(Number);
  const [hh, mi] = hhmm.split(":").map(Number);
  let ts = Date.UTC(y!, mo! - 1, da!, hh!, mi!, 0);
  for (let i = 0; i < 2; i++) {
    ts -= madridOffsetMs(new Date(ts));
  }
  return new Date(ts);
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export default function AddToCalendar({
  title,
  date,
  dateEnd,
  time,
  location,
  slug,
}: Props) {
  const startHHMM = parseTime(time);
  const start = toUtc(date, startHHMM);
  const end =
    toUtc(dateEnd || date, startHHMM) ||
    (start ? new Date(start.getTime() + 2 * 3600_000) : null);

  if (!start || !end) return null;

  const detailsUrl = `https://gasteizclick.javierpalacio.es/evento/${slug}`;

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${utcStamp(start)}/${utcStamp(end)}&location=${encodeURIComponent(
    location
  )}&details=${encodeURIComponent(detailsUrl)}`;

  const buildIcs = () => {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gasteiz Click//Agenda//ES",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${slug}@gasteizclick.javierpalacio.es`,
      `DTSTAMP:${utcStamp(new Date())}`,
      `DTSTART:${utcStamp(start)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${title.replace(/\r?\n/g, " ")}`,
      `LOCATION:${location.replace(/,/g, "\\,")}`,
      `URL:${detailsUrl}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    return new Blob([lines.join("\r\n")], {
      type: "text/calendar;charset=utf-8",
    });
  };

  const downloadIcs = () => {
    const url = URL.createObjectURL(buildIcs());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/*
        El nombre accesible tiene que **contener** el texto que se ve (WCAG 2.5.3):
        el enlace ponía "Añadir a Google Calendar" y dentro decía "Añadir al
        calendario", así que quien usa el comando de voz buscando lo que ve no
        encuentra nada.
      */}
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-border bg-bg-elevated text-sm font-medium text-fg hover:border-accent hover:text-accent transition-colors duration-300 active:scale-[0.98]"
        aria-label="Añadir al calendario en Google Calendar"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2.5" y="4" width="15" height="13" rx="2" />
          <path d="M2.5 8h15M6.5 2.5V5M13.5 2.5V5M10 11v4M8 13h4" />
        </svg>
        Añadir al calendario
      </a>
      <button
        onClick={downloadIcs}
        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full border border-border text-sm font-mono text-fg-muted hover:text-fg hover:border-border-hover transition-colors duration-300 active:scale-[0.98]"
        aria-label="Descargar archivo .ics para cualquier calendario"
      >
        .ics
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13h10" />
        </svg>
      </button>
    </div>
  );
}
