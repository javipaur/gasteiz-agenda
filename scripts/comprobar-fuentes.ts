/**
 * Comprobacion manual de los dos scrapers contra las fuentes reales.
 *
 * Vive en `scripts/` a proposito y **no** lo recoge la suite: es la comprobacion
 * que se hace cuando hay que ver el dato, no el contrato. Los tests usan
 * fixtures y no red.
 *
 *   npx tsx scripts/comprobar-fuentes.ts
 */
import { scrapeArkabia } from "@/lib/sources/arkabia";
import { scrapeBuscametasInscripciones } from "@/lib/sources/buscametas";

async function arkabia() {
  console.log("\n=== Arkabia (home) ===");
  try {
    const eventos = await scrapeArkabia();
    console.log(`  ${eventos.length} eventos`);
    for (const e of eventos.slice(0, 6)) {
      console.log(
        `    ${e.date}  ${e.title.slice(0, 42).padEnd(42)}  ${e.categoria.join("|")}`
      );
    }
    const sinFecha = eventos.filter((e) => !e.date).length;
    if (sinFecha) console.log(`  AVISO: ${sinFecha} sin fecha`);
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }
}

async function inscripciones() {
  console.log("\n=== Inscripciones (buscametas) ===");
  try {
    const eventos = await scrapeBuscametasInscripciones();
    console.log(`  ${eventos.length} eventos`);
    for (const e of eventos.slice(0, 6)) {
      console.log(
        `    ${e.date}  ${String(e.title).slice(0, 38).padEnd(38)}  ${
          e.location
        }  ${e.link ? "CTA" : "proximamente"}`
      );
    }
    const sinLink = eventos.filter((e) => !e.link).length;
    if (sinLink) console.log(`  ${sinLink} sin CTA (inscripcion aun no abierta)`);
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
  }
}

void arkabia().then(inscripciones);
