import { NextResponse } from "next/server";

import { confirmSubscriber } from "@/lib/db";

/**
 * Confirmar la suscripción al newsletter.
 *
 * Esto antes no comprobaba nada: devolvía el mismo 200 y la misma redirección a
 * `?newsletter=confirmed` para cualquier cadena, porque el suscriptor ya había
 * nacido activo en el alta y no quedaba nada pendiente. El enlace de confirmación
 * que se mandaba por correo era decorativo.
 *
 * Ahora el alta deja al suscriptor en `active: false` y este endpoint es lo que
 * lo activa, previa comprobación del token. Sin token, o con un token que no
 * corresponde a nadie, la respuesta no dice «confirmado».
 *
 * Nota: ninguna página lee hoy el parámetro `?newsletter=`, así que la
 * diferencia se ve en la URL y no en pantalla. Hacerla visible en la UI es
 * trabajo aparte, y no cabe en un arreglo de seguridad.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?newsletter=error", req.url));
  }

  const confirmed = confirmSubscriber(token);

  return NextResponse.redirect(
    new URL(confirmed ? "/?newsletter=confirmed" : "/?newsletter=invalid-token", req.url)
  );
}
