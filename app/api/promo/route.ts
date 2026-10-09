import { NextResponse } from "next/server";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { MAX_DIAPOSITIVAS, paqueteDePromo } from "@/lib/promo";
import { localDateStr } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 1800;

/**
 * El paquete del día. Ya no lo construye: lo llama.
 *
 * **El armado vive en `lib/promo.ts` desde que el correo lo necesita sin hablar con este
 * despliegue.** Una copia de estas reglas en el script y otra aquí divergirían el día que
 * se tocara una, y las dos seguirían funcionando: ese es el fallo caro, el que nadie ve.
 *
 * El `utm_content` lleva la fecha y no un texto fijo, que es lo que permite saber después
 * qué post trajo visitas. Para que eso sirva hace falta `NEXT_PUBLIC_ANALYTICS_URL` puesta
 * en Dokploy, porque `app/components/Analytics.tsx` devuelve `null` sin ella. Sin
 * analítica, este parámetro es decorativo.
 *
 * **No hay ninguna llamada a la Graph API aquí ni en ninguna parte de este proyecto.**
 * Publicar es una decisión editorial y la publicación es manual.
 *
 * **Sin carpeta de fecha.** El path es `/api/promo` y la ventana va en la query, y no al
 * revés, porque quien copia la URL de aquí escribe la que le sale: meter `fecha` en el
 * path obligaría a construirla a mano, que es donde aparecen los typos que nadie ve hasta
 * que el post ya está publicado.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const fecha = q.get("fecha") ?? localDateStr(new Date());
  const desde = q.get("desde") ?? fecha;
  const hasta = q.get("hasta") ?? desde;
  const limite = Math.min(Number(q.get("limite")) || MAX_DIAPOSITIVAS, MAX_DIAPOSITIVAS);

  const eventos = await getAgendaEventos();
  // El selector es el de `lib/recomendados.ts`, sin reimplementar nada aquí. Es lo que
  // hace que un post y la página digan lo mismo.
  const lista = recomendados(eventos, { desde, hasta, limite });

  return NextResponse.json(paqueteDePromo(lista, { desde, hasta }));
}