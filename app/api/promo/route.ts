import { NextResponse } from "next/server";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { ORIGEN_PROMO, urlDePromo, textoDelPie } from "@/lib/promo";
import { localDateStr } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 1800;

/** Instagram no acepta más de diez diapositivas, y una es la portada. */
const MAX_DIAPOSITIVAS = 9;

/**
 * El paquete del día, listo para copiar y publicar.
 *
 * **No hay ninguna llamada a la Graph API aquí ni en ninguna parte de este
 * proyecto.** Publicar es una decisión editorial y la publicación es manual: este
 * endpoint devuelve lo que se copia, y quien publica decide si hoy merece la pena.
 *
 * El `utm_content` lleva la fecha y no un texto fijo, que es lo que permite saber
 * después qué post trajo visitas. Para que eso sirva hace falta
 * `NEXT_PUBLIC_ANALYTICS_URL` puesta en Dokploy, porque `app/components/Analytics.tsx`
 * devuelve `null` sin ella. Sin analítica, este parámetro es decorativo.
 *
 * **Sin carpeta de fecha.** El path es `/api/promo` y la ventana va en la query, y no
 * al revés, porque quien copia la URL de aquí escribe la que le sale: meter `fecha` en
 * el path obligaría a construirla a mano, que es donde aparecen los typos que nadie ve
 * hasta que el post ya está publicado.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const fecha = q.get("fecha") ?? localDateStr(new Date());
  const desde = q.get("desde") ?? fecha;
  const hasta = q.get("hasta") ?? desde;
  const limite = Math.min(Number(q.get("limite")) || MAX_DIAPOSITIVAS, MAX_DIAPOSITIVAS);

  const eventos = await getAgendaEventos();
  // El selector es el de `lib/recomendados.ts`, sin reimplementar nada aquí. Es lo que
  // hace que un post y la página digan lo mismo: si se copiaran las dos reglas,
  // divergirían el día que se tocara una.
  const lista = recomendados(eventos, { desde, hasta, limite });

  const ventana = `${ORIGEN_PROMO}/hoy?desde=${desde}&hasta=${hasta}`;
  const enlace =
    `${ventana}&utm_source=ig&utm_medium=social&utm_content=gasteizclick-${desde}`;

  return NextResponse.json({
    portada: urlDePromo(desde),
    imagenes: lista.map((e) => urlDePromo(desde, e.slug)),
    pie: ventana,
    texto: textoDelPie(lista, desde, hasta),
    enlace,
  });
}