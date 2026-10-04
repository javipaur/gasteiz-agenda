import axios from "axios";
import FormData from "form-data";
import * as cheerio from "cheerio";

type BuscametasEvento = {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
};

function transformarEventos(apiEventos: any[]): BuscametasEvento[] {
  return apiEventos.map((e: any) => ({
    title: e.nombre,
    date: e.fecha_ini ? new Date(e.fecha_ini).toISOString() : new Date().toISOString(),
    image: e.imagen,
    location: `${e.poblacion}${e.prov ? ` ${e.prov}` : ""}`,
    link: e.web || "#",
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function scrapeBuscametasCalendario(): Promise<BuscametasEvento[]> {
  const data = new FormData();
  data.append("zona", "alava");
  data.append("distancia_min", "0");
  data.append("distancia_max", "100");
  data.append("desde", new Date().toISOString().split("T")[0]);
  data.append("rangeInputModal", "50");
  data.append("idioma", "ES");

  const response = await axios.post(
    "https://www.buscametas.com/modulos/calendario/fuentes/get_eventos.php",
    data,
    // `timeout` de axios, no `signal`: es axios quien cancela, y un POST multipart
    // sin plazo es el mismo agujero que los demás —`Promise.allSettled` en
    // `lib/agenda.ts` no vuelve hasta que vuelven las 28 fuentes. 20000 es el
    // plazo que ya usan los otros seis.
    { headers: data.getHeaders(), timeout: 20000 }
  );

  return transformarEventos((response.data as { eventos: any[] }).eventos);
}

/**
 * `dd/mm/yyyy` a ISO, en medianoche **local**, o `undefined` si no es una fecha.
 *
 * Es una función y no una expresión suelta porque la usan dos sitios que no pueden
 * divergir: la ISO que viaja en `dateIso` y la que ordena la lista. Comparar
 * `new Date("04/10/2026")` es ambiguo —V8 lo lee como 9 de abril— y con dos
 * conversiones escritas aparte la lista acabaría ordenada por un criterio y la
 * agenda por otro.
 *
 * Se construye con `new Date(y, m-1, d)`, o sea medianoche local, y no partiendo
 * de una cadena `YYYY-MM-DD`, que sería UTC: al este de UTC eso cae a las 02:00
 * del día correcto, pero en cualquier huso al oeste cae al día anterior. El repo
 * ya usa medianoche local en `lib/sources/senderismo.ts`, y la clave de dedupe de
 * `lib/agenda.ts` ya sabe leer esa clase de cadena en hora local.
 *
 * El mes se valida con su vuelta porque `new Date(2026, 11, 31)` no es inválido:
 * es el 1 de enero de 2027. Sin esa comprobación, un `31/12/2026` de la página
 * pasaría aquí como fecha de enero y aparecería en la agenda del año que viene.
 */
function ddmmyyyyAIso(fecha: string): string | undefined {
  const partes = fecha.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return undefined;

  const [, dia, mes, anio] = partes;
  const d = new Date(Number(anio), Number(mes) - 1, Number(dia));
  if (
    d.getFullYear() !== Number(anio) ||
    d.getMonth() !== Number(mes) - 1 ||
    d.getDate() !== Number(dia)
  ) {
    return undefined;
  }
  return d.toISOString();
}

export async function scrapeBuscametasInscripciones(): Promise<any[]> {
  // `fetch` y no `axios`, a diferencia de `scrapeBuscametasCalendario` de este
  // mismo fichero. Ese hace un POST multipart con `form-data`, que axios resuelve
  // bien y `fetch` no. Este es un GET simple, y con axios **no se podia testear**:
  // `mockFetchWith` intercepta `global.fetch`, asi que el mock no llegaba y los
  // tests setaban pegando a la red de verdad —que es como pasaban con el
  // selector muerto. Los 24 scrapers que si tienen test usan `fetch`.
  const res = await fetch("https://www.buscametas.com/inscripciones/", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NextScraper/1.0)" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`buscametas inscripciones returned ${res.status}`);
  }

  const data = await res.text();
  const $ = cheerio.load(data);
  const eventos: any[] = [];

  // El contenedor era `tr.card` y ahora es `.insc-item`, con las clases `i2-*`
  // dentro. Medido contra la pagina en vivo: `tr.card` = 0 elementos y
  // `.insc-item` = 21, o sea que el `.each()` no recorria nada y la ruta
  // respondia 200 con `{"eventos":[]}`. Un fallo de selector aqui no se ve: es
  // una lista vacia, que es lo que devuelve un cine sin eventos.
  $(".insc-item").each((_, el) => {
    const row = $(el);
    const title = row.find(".i2-nombre").text().trim();
    const date = row.find(".i2-fecha").text().trim();
    const location = row.find(".i2-loc").text().trim();
    const link = row.find(".i2-cta").attr("href")?.trim() ?? "";
    const rawImage = row.find(".i2-card-media img").attr("src")?.trim() ?? "";
    const image = rawImage
      ? rawImage.startsWith("http")
        ? rawImage
        : `https://www.buscametas.com${rawImage.startsWith("/") ? "" : "/"}${rawImage}`
      : "";

    // La fecha del sitio puede ser simple ("04/10/2026") o un rango
    // ("31/10/2026 - 01/11/2026"). Se normaliza a la de **inicio**, que es la que
    // ordena y la que la app pinta. Se deja el rango entero en `dateRango` para
    // quien quiera el detalle: recortarlo pierde informacion que el sitio
    // publica.
    const rangoFecha = date.match(
      /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/
    );
    const fechaInicio = rangoFecha ? rangoFecha[1] : date;

    eventos.push({
      title,
      // `date` se queda en `dd/mm/yyyy` porque es el contrato con la app movil:
      // `InscribeteTabs.tsx` la parte con `split('/')` y si esto pasara a ISO,
      // `month` seria "2026-10-04" y `parseInt` daria NaN, con la pantalla en
      // blanco y sin error. La ISO viaja **aparte** en `dateIso`, que es lo que
      // lee `normalizeRaw`; asi el movil no se entera y la agenda por fin puede
      // entender la fecha. Anadir un campo es aditivo: ningun cliente que lea
      // `date` por nombre se rompe.
      date: fechaInicio,
      dateIso: ddmmyyyyAIso(fechaInicio),
      dateRango: rangoFecha ? date : undefined,
      location,
      link: link
        ? `https://www.buscametas.com${link.startsWith("/") ? "" : "/"}${link}`
        : "",
      image,
    });
  });

  // Ordena por la misma conversion que emite `dateIso`, y no por un `split("/")
  // .reverse()` escrito aqui: son el mismo calculo en dos sitios, y si uno se
  // queda sin tocar la lista y la agenda iran en direcciones distintas. Una fecha
  // que no se pueda convertir va al final en vez de comparar contra `NaN`, que no
  // ordena nada y dejaba su posicion en manos del `sort` estable.
  eventos.sort((a, b) => {
    const aIso = ddmmyyyyAIso(a.date);
    const bIso = ddmmyyyyAIso(b.date);
    if (aIso && bIso) return new Date(aIso).getTime() - new Date(bIso).getTime();
    if (aIso) return -1;
    if (bIso) return 1;
    return 0;
  });

  return eventos;
}

