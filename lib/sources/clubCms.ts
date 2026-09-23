export type ClubKey = "baskonia" | "alaves" | "araski";

export interface Escudo {
  nombre: string;
  url?: string;
}

export interface Partido {
  id: string;
  equipo: ClubKey;
  club: string;
  competicion: string;
  fecha: string | null;
  hora: string | null;
  local: Escudo;
  visitante: Escudo;
  estadio: string | null;
  marcador: { local: number; visitante: number } | null;
  link: string | null;
  fuente: "cms" | "manual";
}

const CMS_ORIGIN = "https://cms.deportivoalaves.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface ClubCfg {
  key: ClubKey;
  club: string;
  team: string;
  seasonId: number;
}

const CLUB_CONFIG: Record<Exclude<ClubKey, "araski">, ClubCfg> = {
  baskonia: { key: "baskonia", club: "Kosner Baskonia", team: "Kosner Baskonia", seasonId: 25 },
  alaves: { key: "alaves", club: "Deportivo Alavés", team: "Deportivo Alavés", seasonId: 19 },
};

function attributesOf(holder: unknown): Record<string, unknown> {
  if (!holder || typeof holder !== "object") return {};
  const obj = holder as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object") {
    const d = obj.data as Record<string, unknown>;
    if (d.attributes && typeof d.attributes === "object") {
      return d.attributes as Record<string, unknown>;
    }
    return d;
  }
  if (obj.attributes && typeof obj.attributes === "object") {
    return obj.attributes as Record<string, unknown>;
  }
  return obj;
}

function firstUrl(holder: unknown): string | undefined {
  if (!holder) return undefined;
  if (typeof holder === "string") {
    return holder.startsWith("/") ? `${CMS_ORIGIN}${holder}` : holder;
  }
  const url = attributesOf(holder).url;
  if (typeof url === "string") {
    return url.startsWith("/") ? `${CMS_ORIGIN}${url}` : url;
  }
  return undefined;
}

function nameOf(holder: unknown): string {
  const name = attributesOf(holder).name;
  return typeof name === "string" ? name : "";
}

function seasonIdOf(attrs: Record<string, unknown>): number | null {
  const seasons = attrs.seasons;
  if (!Array.isArray(seasons)) return null;
  for (const s of seasons) {
    if (s && typeof s === "object") {
      const a = attributesOf(s as { attributes?: unknown });
      const id = Number(a.id);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }
  return null;
}

function extractLink(attrs: Record<string, unknown>): string | null {
  const direct = typeof attrs.link === "string" ? attrs.link : firstUrl(attrs.link);
  if (direct) return direct;
  const buttons = attrs.buttons;
  if (Array.isArray(buttons)) {
    for (const b of buttons) {
      const u = firstUrl(b);
      if (u) return u;
    }
  }
  return null;
}

function filterGameTime(gameTime: string | null): string | null {
  if (typeof gameTime !== "string") return null;
  const m = gameTime.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:00`;
}

function gamesUrl(cfg: ClubCfg, opts: { seasonId?: number; sort?: string }): string {
  const p = new URLSearchParams();
  p.set("populate[homeTeam][populate]", "shield");
  p.set("populate[awayTeam][populate]", "shield");
  p.set("populate[competition][populate]", "logo");
  p.set("populate[seasons]", "*");
  p.set("populate[link]", "*");
  p.set("populate[buttons]", "*");
  p.set("filters[$or][0][homeTeam][name][$eq]", cfg.team);
  p.set("filters[$or][1][awayTeam][name][$eq]", cfg.team);
  if (opts.seasonId) p.set("filters[seasons][id][$eq]", String(opts.seasonId));
  p.set("sort[0]", opts.sort ?? "gameDate:asc");
  p.set("pagination[pageSize]", "100");
  p.set("locale", "es");
  return `${CMS_ORIGIN}/api/games-items?${p.toString()}`;
}

async function fetchGamesItems(url: string): Promise<unknown[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const body = await res.json().catch(() => null);
    const list = (body as { data?: unknown })?.data;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function detectSeasonId(cfg: ClubCfg): Promise<number> {
  const url = gamesUrl(cfg, { sort: "gameDate:desc" });
  const games = await fetchGamesItems(url);
  for (const game of games) {
    const id = seasonIdOf(attributesOf(game));
    if (id) return id;
  }
  return cfg.seasonId;
}

function mapGame(cfg: ClubCfg, game: unknown, index: number): Partido {
  const attrs = attributesOf(game);
  const rawId = (game as { id?: unknown })?.id;
  const id =
    typeof rawId === "string" || typeof rawId === "number"
      ? `${cfg.key}-${String(rawId)}`
      : `${cfg.key}-${index}`;

  const gameDate = typeof attrs.gameDate === "string" ? attrs.gameDate : null;
  const hora = filterGameTime(
    typeof attrs.gameTime === "string" ? attrs.gameTime : null
  );

  let fecha: string | null = null;
  if (gameDate && /^\d{4}-\d{2}-\d{2}/.test(gameDate)) {
    fecha = hora ? `${gameDate}T${hora}+02:00` : `${gameDate}T00:00:00+02:00`;
  }

  const homeScore = attrs.homeScore;
  const awayScore = attrs.awayScore;
  const marcador =
    typeof homeScore === "number" && typeof awayScore === "number"
      ? { local: homeScore, visitante: awayScore }
      : null;

  return {
    id,
    equipo: cfg.key,
    club: cfg.club,
    competicion: nameOf(attrs.competition) || "Competición",
    fecha,
    hora,
    local: { nombre: nameOf(attrs.homeTeam) || "Local", url: firstUrl(attributesOf(attrs.homeTeam).shield) },
    visitante: { nombre: nameOf(attrs.awayTeam) || "Visitante", url: firstUrl(attributesOf(attrs.awayTeam).shield) },
    estadio: typeof attrs.stadiumName === "string" ? attrs.stadiumName : null,
    marcador,
    link: extractLink(attrs),
    fuente: "cms",
  };
}

async function scrapeClub(cfg: ClubCfg): Promise<Partido[]> {
  const seasonId = await detectSeasonId(cfg);
  const url = gamesUrl(cfg, { seasonId, sort: "gameDate:asc" });
  const games = await fetchGamesItems(url);
  return games.map((game, i) => mapGame(cfg, game, i));
}

export async function scrapePartidosCMS(): Promise<Partido[]> {
  const [baskonia, alaves] = await Promise.allSettled([
    scrapeClub(CLUB_CONFIG.baskonia),
    scrapeClub(CLUB_CONFIG.alaves),
  ]);
  const out: Partido[] = [];
  if (baskonia.status === "fulfilled") out.push(...baskonia.value);
  if (alaves.status === "fulfilled") out.push(...alaves.value);
  return out;
}