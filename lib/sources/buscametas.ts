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

  eventos.push({
      title,
      date: rangoFecha ? rangoFecha[1] : date,
      dateRango: rangoFecha ? date : undefined,
      location,
      link: link ? `https://www.buscametas.com${link.startsWith("/") ? "" : "/"}${link}` : "",
      image,
    });
  });

  // Ya viene en `dd/mm/yyyy` y, con el rango recortado arriba, sin el guion. El
  // sort compara en ISO para no depender del idioma: `new Date("04/10/2026")`
  // lo interpreta como octubre en algunos navegadores y como abril en otros.
  eventos.sort((a, b) => {
    const aIso = a.date.split("/").reverse().join("-");
    const bIso = b.date.split("/").reverse().join("-");
    return new Date(aIso).getTime() - new Date(bIso).getTime();
  });

  return eventos;
}
