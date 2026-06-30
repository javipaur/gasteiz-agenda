const CITY_SLUG = "vitoria-gasteiz";
const LANGUAGE = "en";
const FEVER_BASE = "https://feverup.com";

export interface FeverEvent {
  id: string;
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
  category: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/candlelight/.test(text)) return "Conciertos";
  if (/concert|live|band|dj|música|rock|pop|festi|tribute|orchestra|piano|violin/.test(text)) return "Conciertos";
  if (/cinema|film|movie|película|cine/.test(text)) return "Cine";
  if (/theater|teatro|obra|play|danza|dance/.test(text)) return "Teatro";
  if (/exhibition|exposición|arte|art|museum|museo|gallery|galería/.test(text)) return "Exposiciones";
  if (/tour|visita|guided|city|walking|excursión|ruta/.test(text)) return "Visitas";
  if (/gastronomy|food|wine|vino|cooking|degustación|gastronomía/.test(text)) return "Gastronomía";
  if (/kids|infantil|familia|children|niños/.test(text)) return "Infantil";
  if (/workshop|taller|class|curso|aprende|learn/.test(text)) return "Talleres";
  if (/wellness|yoga|spa|fitness|salud|deporte|sport/.test(text)) return "Deporte";
  return "Cultura";
}

export async function scrapeFever(): Promise<FeverEvent[]> {
  const res = await fetch(
    `https://feverup.com/${LANGUAGE}/${CITY_SLUG}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 3600 },
    }
  );
  const html = await res.text();

  const urlPattern = /href="([^"]*\/m\/\d+\/[^"]*)"/g;
  const urls = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith("/")) {
      urls.add(`${FEVER_BASE}${href}`);
    } else {
      urls.add(href);
    }
  }

  const allEvents: FeverEvent[] = [];
  let idx = 0;

  for (const url of urls) {
    idx++;
    await delay(200);

    try {
      const detailRes = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        next: { revalidate: 3600 },
      });

      if (!detailRes.ok) continue;

      const detailHtml = await detailRes.text();
      const ldRe =
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

      let eventData: any = null;
      let ldMatch: RegExpExecArray | null;
      while ((ldMatch = ldRe.exec(detailHtml)) !== null) {
        try {
          const parsed = JSON.parse(ldMatch[1]);
          if (parsed["@type"] === "Event") {
            eventData = parsed;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!eventData) continue;

      const planId = url.match(/\/m\/(\d+)/)?.[1];
      if (!planId) continue;

      const locality = eventData.location?.address?.addressLocality || "";
      const venueName = eventData.location?.name || "";
      const title = eventData.name || "";

      if (!title) continue;

      const localityLower = locality.toLowerCase();
      const vitoriaRelated =
        !locality ||
        /vitoria|gasteiz|álava|alava|lacua|salburua|zabalgana|arriaga|judimendi|sansomendi|abendaño/.test(
          localityLower
        );
      if (!vitoriaRelated) continue;

      const image =
        typeof eventData.image === "string"
          ? eventData.image
          : eventData.image?.contentUrl || "";

      const location =
        locality && venueName
          ? `${venueName}, ${locality}`
          : locality || venueName || "Vitoria-Gasteiz";

      const description = eventData.description || "";
      const category = inferCategory(title, description);

      allEvents.push({
        id: `fever-${planId}`,
        title: title.trim(),
        date: eventData.startDate || "",
        image,
        location,
        link: url,
        description: description.slice(0, 500),
        category,
      });
    } catch {
      continue;
    }
  }

  return allEvents;
}
