// app/api/actividades/eventos/route.ts
import { withPuppeteerCache, CacheEntry } from "@/lib/puppeteerCache";

const BASE_URL = "https://koraliving.com";
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 horas — experiencias muy estáticas

const cache: { entry: CacheEntry<any[]> | null } = { entry: null };

export async function GET() {
  try {
    const result = await withPuppeteerCache(cache, CACHE_TTL, async (page) => {
      await page.goto(
        `${BASE_URL}/greencity/es/experiencias-locales/conscious-green-experiences/`,
        { waitUntil: "domcontentloaded", timeout: 20000 }
      );

      await page.waitForSelector(".default-slider__holder .card-experience", {
        timeout: 15000,
      });

      const experiencias = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".default-slider__holder .card-experience")
        ).map((el) => {
          const icons = Array.from(el.querySelectorAll(".icons div span")).map(
            (s) => (s as HTMLElement).innerText?.trim()
          );

          return {
            title: (el.querySelector(".title.font-style-card-title-small") as HTMLElement)?.innerText?.trim() || null,
            description: (el.querySelector(".description.font-style-card-body") as HTMLElement)?.innerText?.trim() || null,
            image: (el.querySelector(".image figure img") as HTMLImageElement)?.src || null,
            moreInfo: (el.querySelector(".image a.font-style-link") as HTMLAnchorElement)?.href || null,
            reservation: (el.querySelector("a.button.--light") as HTMLAnchorElement)?.href || null,
            schedule: icons[0] || null,
            duration: icons[1] || null,
            price: icons[2] || null,
            language: icons[3] || null,
          };
        });
      });

      return experiencias;
    });

    return new Response(
      JSON.stringify({
        cached: result.cached,
        ...(result.warning ? { warning: result.warning } : {}),
        experiencias: result.data,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scraping Kora Green City:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
