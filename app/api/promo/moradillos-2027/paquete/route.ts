import { MORADILLOS_2027, RUTAS_PROMO_MORADILLOS } from "@/lib/moradillos-2027";

/**
 * El paquete que n8n recoge. No publica: solo dice qué piezas existen y dónde
 * están. La decisión de si este festival se publica sigue siendo de una persona.
 *
 * Las claves van cerradas a propósito: un consumidor que espere `imagen` en
 * vez de `piezas` debe fallar aquí, no a mitad de un flujo de publicación.
 */
export function GET() {
  return Response.json({
    destino: MORADILLOS_2027.destino,
    fechas: MORADILLOS_2027.fechas,
    sede: MORADILLOS_2027.sede,
    piezas: [
      {
        archivo: "post-moradillos-2027.jpg",
        url: RUTAS_PROMO_MORADILLOS.post,
        tamano: "1080x1350",
      },
      {
        archivo: "historia-moradillos-2027.jpg",
        url: RUTAS_PROMO_MORADILLOS.historia,
        tamano: "1080x1920",
      },
      {
        archivo: "cartel-moradillos-2027.jpg",
        url: RUTAS_PROMO_MORADILLOS.cartel,
        tamano: "1600x1600",
      },
    ],
  });
}
