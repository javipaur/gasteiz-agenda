import { scrapeGasteizHoy } from "../lib/sources/gasteizhoy";
import { scrapeVamEvents, scrapeVamConciertos } from "../lib/sources/vam";
import { scrapeRula } from "../lib/sources/rula";
import { scrapeMusikaze } from "../lib/sources/musikaze";
import { scrapeHelldorado } from "../lib/sources/helldorado";
import { scrapeJimmyJazz } from "../lib/sources/jimmyjazz";
import { scrapeEuskadi } from "../lib/sources/euskadi";
import { scrapeFever } from "../lib/sources/fever";

type Result = { name: string; count: number; error?: string; sample?: string[] };

async function run(name: string, fn: () => Promise<any[]>): Promise<Result> {
  try {
    const items = await fn();
    return {
      name,
      count: items.length,
      sample: items.slice(0, 3).map((e) => {
        const t = e.title || e.name || "?";
        const d = e.date ? ` (${String(e.date).slice(0, 10)})` : "";
        return `${t}${d}`;
      }),
    };
  } catch (err) {
    return { name, count: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

const results: Result[] = [];

async function main() {
  results.push(await run("gasteizhoy", scrapeGasteizHoy));
  results.push(await run("vam (agenda)", scrapeVamEvents));
  results.push(await run("vam (conciertos)", scrapeVamConciertos));
  results.push(await run("rula", scrapeRula));
  results.push(await run("musikaze", scrapeMusikaze));
  results.push(await run("helldorado", scrapeHelldorado));
  results.push(await run("jimmyjazz", scrapeJimmyJazz));
  results.push(await run("euskadi", scrapeEuskadi));
  results.push(await run("fever", scrapeFever));

  console.log("\n=== RESULTADOS POR FUENTE ===\n");
  for (const r of results) {
    if (r.error) {
      console.log(`✗ ${r.name.padEnd(20)} ERROR: ${r.error.slice(0, 120)}`);
    } else {
      console.log(`✓ ${r.name.padEnd(20)} ${r.count} eventos`);
      for (const s of r.sample || []) console.log(`   · ${s}`);
    }
  }
  const failed = results.filter((r) => r.error);
  console.log(`\n${results.length - failed.length}/${results.length} fuentes OK, ${failed.length} con error\n`);
}

main();
