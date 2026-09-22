const PWA_BASE = "https://www.vitoria-gasteiz.org/pwa/vgbus";
const J1602_BASE =
  "https://www.vitoria-gasteiz.org/j16-02w/detalleAction.do";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type VgParada = {
  idParada: string;
  nombre: string;
  direccion?: string;
  idRuta?: string;
  distancia?: number;
  alertas?: string[];
  medio?: string;
};

export type VgLinea = {
  id: string;
  nombre: string;
  codigo: string;
  codigoCorto: string;
  grupo: string;
  color: string;
  esTranvia: boolean;
};

export type VgResultado = {
  punto: VgParada;
  lineas: VgLinea[];
  distancia?: number;
  distanciaMetros?: number;
};

export type VgLlegada = {
  line: string;
  destination: string;
  stopId: string;
  seconds: number;
  realtime: boolean;
  realTimeState: string;
  trip: string;
  stopCount: number;
  vehiculo?: string;
  vehiculoId?: string;
  status?: string;
  latitud?: number;
  longitud?: number;
  caducada?: boolean;
};

export type VgAlerta = {
  line?: string;
  stopId?: string;
  alertHeader: string;
  alertDescription?: string;
  alertPeriodStart: number;
  alertPeriodEnd: number;
  alertCause?: string;
  alertEffect?: string;
  alertUrl?: string;
};

type RawAlertaJson = {
  line?: string;
  linea?: string;
  stopId?: string;
  alertHeader?: string;
  alertDescription?: string;
  alertPeriodStart?: number;
  alertPeriodEnd?: number;
  alertCause?: string;
  alertEffect?: string;
  alertUrl?: string;
};

type RawLlegadaResponse = {
  llegadas?: RawLlegada[];
  alertas?: RawAlertaJson[];
};

type RawAlertaResponse = {
  alertas?: RawAlertaJson[];
};

type RawLlegada = {
  line: string | number;
  destination?: string;
  stopId?: string | number;
  seconds?: number;
  realtime?: boolean;
  realTimeState?: string;
  trip?: string;
  stopCount?: string | number;
  vehiculo?: string | number;
  vehiculoId?: string | number;
  status?: string;
  latitud?: number;
  longitud?: number;
};

type RawRuta = {
  id?: string | number;
  nombre?: string;
  grupoNombre?: string;
  color?: string;
};

type RawParadaDetalle = {
  punto: RawPunto;
  rutas?: RawRuta[];
};

function lineaFromRuta(ruta: RawRuta): VgLinea {
  const nombre: string = ruta.nombre || "";
  const codigo = nombre.split(" ")[0];
  const codigoCorto = codigo.replace(/[A-D]/g, "").replace("L", "");
  // "TG" = tranvía, resto = autobús
  const esTranvia = codigo.toUpperCase().startsWith("TG");
  return {
    id: String(ruta.id ?? ""),
    nombre,
    codigo,
    codigoCorto,
    grupo: ruta.grupoNombre || "",
    color: ruta.color || "",
    esTranvia,
  };
}

function ordenarLineas(lineas: VgLinea[]): VgLinea[] {
  const order: Record<string, number> = { TG: 0, L: 1, E: 2, G: 3 };
  const unique: VgLinea[] = [];
  for (const l of lineas) {
    if (!unique.some((u) => u.codigo === l.codigo)) unique.push(l);
  }
  return unique.sort((a, b) => {
    const fa = order[a.codigo[0]?.toUpperCase()] ?? 9;
    const fb = order[b.codigo[0]?.toUpperCase()] ?? 9;
    if (fa !== fb) return fa - fb;
    const na = parseInt(a.codigo.match(/\d+/)?.[0] || "999", 10);
    const nb = parseInt(b.codigo.match(/\d+/)?.[0] || "999", 10);
    if (na !== nb) return na - nb;
    return a.codigo.localeCompare(b.codigo);
  });
}

type RawPunto = {
  idParada: string | number;
  nombre?: string;
  direccion?: string;
};

type RawBuscarResponse = {
  resultado?: {
    punto: RawPunto;
    rutas?: RawRuta[];
    distancia?: number;
  }[];
};

function resultadoDesdeRaw(raw: RawBuscarResponse): VgResultado[] {
  if (!raw || !Array.isArray(raw.resultado)) return [];
  return raw.resultado
    .filter((r) => r && r.punto && r.punto.idParada)
    .map((r) => ({
      punto: {
        idParada: String(r.punto.idParada),
        nombre: r.punto.nombre || "",
        direccion: r.punto.direccion || "",
      },
      lineas: ordenarLineas((r.rutas || []).map(lineaFromRuta)),
      distancia: r.distancia,
      distanciaMetros:
        typeof r.distancia === "number"
          ? Math.round(r.distancia * 1000)
          : undefined,
    }));
}

function alertaDesdeRaw(a: RawAlertaJson): VgAlerta {
  const activar = (v: string) =>
    typeof v === "string" ? v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : v;
  return {
    line: String(a.line ?? a.linea ?? ""),
    stopId: a.stopId ?? "",
    alertHeader: activar(a.alertHeader || (a.line || a.linea ? `Línea ${a.line || a.linea}` : "Aviso")) || "Aviso",
    alertDescription: activar(a.alertDescription || ""),
    alertPeriodStart: a.alertPeriodStart || 0,
    alertPeriodEnd: a.alertPeriodEnd || 0,
    alertCause: a.alertCause || "",
    alertEffect: a.alertEffect || "",
    alertUrl: a.alertUrl || "",
  };
}

function filtrarAlertasActivas(alertas: VgAlerta[]): VgAlerta[] {
  const now = Date.now();
  return alertas
    .filter((alerta) => {
      // ocultar alertas cuyo período ya haya finalizado
      if (alerta.alertPeriodEnd && now > alerta.alertPeriodEnd * 1000) return false;
      // ocultar alertas cuyo período empiece en el futuro lejano (> 12 h)
      if (alerta.alertPeriodStart && alerta.alertPeriodStart * 1000 > now + 12 * 3600 * 1000) return false;
      return true;
    })
    .sort((a, b) => {
      const al = a.line?.replace("*", "0") || "0";
      const bl = b.line?.replace("*", "0") || "0";
      const na = parseInt(al, 10) || 0;
      const nb = parseInt(bl, 10) || 0;
      if (na !== nb) return na - nb;
      const ca = a.line === "*" ? -1 : 1;
      const cb = b.line === "*" ? -1 : 1;
      return ca - cb;
    });
}

const cache = new Map<string, { data: unknown; at: number }>();
function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.data as T);
  return fetcher().then((data) => {
    cache.set(key, { data, at: Date.now() });
    return data;
  });
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    signal: signal || AbortSignal.timeout(12000),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  return res.json();
}

const SEARCH_TTL = 1000 * 60 * 60; // 60 min
const REALTIME_TTL = 1000 * 45; // 45 s
const ALERTS_TTL = 1000 * 60 * 5; // 5 min

export async function buscarParadas(texto: string): Promise<VgResultado[]> {
  const q = texto.trim();
  if (!q) return [];
  return cached(`buscar:${q.toLowerCase()}`, SEARCH_TTL, async () => {
    const url = `${PWA_BASE}?accion=buscar&buscar=${encodeURIComponent(q)}&idioma=es`;
    const json = await fetchJson(url);
    return resultadoDesdeRaw(json as RawBuscarResponse);
  });
}

export async function paradasCercanas(
  lat: number,
  lng: number,
  radio = 300
): Promise<VgResultado[]> {
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];
  const clamp = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const radioClamp = clamp.reduce((acc, v) => (Math.abs(v - radio) < Math.abs(v - acc) ? v : acc), radio > 1000 ? 1000 : 100);
  return cached(`cerca:${lat.toFixed(5)}:${lng.toFixed(5)}:${radioClamp}`, SEARCH_TTL, async () => {
    const url = `${PWA_BASE}?accion=cerca&idioma=es&pt=${lat},${lng}&radio=${radioClamp}`;
    const json = await fetchJson(url);
    return resultadoDesdeRaw(json as RawBuscarResponse);
  });
}

export async function detalleParada(idParada: string): Promise<{ parada: VgParada; lineas: VgLinea[] } | null> {
  if (!idParada) return null;
  return cached(`parada:${idParada}`, SEARCH_TTL, async () => {
    const url = `${PWA_BASE}?accion=parada&idParada=${encodeURIComponent(idParada)}&idioma=es`;
    const raw = (await fetchJson(url)) as unknown as RawParadaDetalle[];
    if (!Array.isArray(raw) || !raw[0] || !raw[0].punto) return null;
    return {
      parada: {
        idParada: String(raw[0].punto.idParada),
        nombre: raw[0].punto.nombre || "",
        direccion: raw[0].punto.direccion || "",
      },
      lineas: ordenarLineas((raw[0].rutas || []).map(lineaFromRuta)),
    };
  });
}

export async function consultaLlegadas(
  idParada: string
): Promise<{ llegadas: VgLlegada[]; alertas: VgAlerta[] }> {
  if (!idParada) return { llegadas: [], alertas: [] };
  return cached(`realTime:${idParada}`, REALTIME_TTL, async () => {
    const url = `${J1602_BASE}?accion=CONSULTA_PARADAS&charset=UTF-8&idParada=${encodeURIComponent(idParada)}&datosVehiculo=true`;
    const json = (await fetchJson(url)) as unknown as RawLlegadaResponse;
    if (!json || !Array.isArray(json.llegadas)) return { llegadas: [], alertas: [] };

    const llegadas: VgLlegada[] = json.llegadas
      .filter((l: RawLlegada) => l && l.line && typeof l.seconds === "number")
      .map((l: RawLlegada) => {
        const realTimeState: string = l.realTimeState || "";
        const cancelada =
          realTimeState === "CANCELED" || l.status === "CANCELED";
        return {
          line: String(l.line),
          destination: (l.destination || "").trim(),
          stopId: String(l.stopId ?? ""),
          seconds: l.seconds ?? 0,
          realtime: !!l.realtime,
          realTimeState,
          trip: l.trip || "",
          stopCount: Number(l.stopCount) || 0,
          vehiculo: l.vehiculo ? String(l.vehiculo) : undefined,
          vehiculoId: l.vehiculoId ? String(l.vehiculoId) : undefined,
          status: l.status || undefined,
          latitud: typeof l.latitud === "number" ? l.latitud : undefined,
          longitud: typeof l.longitud === "number" ? l.longitud : undefined,
          caducada: cancelada,
        };
      })
      .sort((a: VgLlegada, b: VgLlegada) => a.seconds - b.seconds);

    const alertas: VgAlerta[] = filtrarAlertasActivas(
      (json.alertas || []).map(alertaDesdeRaw)
    );

    return { llegadas, alertas };
  });
}

export async function consultarAlertas(): Promise<VgAlerta[]> {
  return cached("alertas:global", ALERTS_TTL, async () => {
    const url = `${J1602_BASE}?accion=CONSULTA_RUTA&charset=UTF-8&type=alerts`;
    const json = (await fetchJson(url)) as unknown as RawAlertaResponse;
    if (!json || !Array.isArray(json.alertas)) return [];
    return filtrarAlertasActivas(json.alertas.map(alertaDesdeRaw));
  });
}