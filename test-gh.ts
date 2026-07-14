import { scrapeGasteizHoy } from "./lib/sources/gasteizhoy";

async function main() {
  const events = await scrapeGasteizHoy();
  const withImg = events.filter((e) => e.image);
  const withoutImg = events.filter((e) => !e.image);
  console.log("Total:", events.length, "| With image:", withImg.length, "| Without:", withoutImg.length);
  console.log();
  console.log("--- Events WITHOUT image ---");
  withoutImg.forEach((e) => console.log("  -", e.title.slice(0, 60), "| link:", e.link?.slice(0, 80)));
  console.log();
  console.log("--- Events WITH image ---");
  withImg.forEach((e) => console.log("  -", e.title.slice(0, 50), "| img:", e.image?.slice(0, 120)));
}
main();
