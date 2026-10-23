import { ImageResponse } from "next/og";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import {
  MAX_DIAPOSITIVAS,
  PALETA_PROMO,
  TAMANO_PROMO,
  urlImagenPromo,
  ventanaCortaPromo,
  ventanaDelDia,
} from "@/lib/promo";
import { CabeceraPromo, MarcaPromo } from "@/lib/promo-marca";

export const runtime = "nodejs";
// Es una imagen que se puede cachear un rato: el mismo día da la misma portada.
export const revalidate = 1800;

type Ctx = { params: Promise<{ fecha: string }> };

/*
 * **La portada es el plan que de verdad hay, no un contador.**
 *
 * Antes era un número de 190 px sobre fondo negro y el título del primer evento debajo,
 * sin foto y sin marca. Funcionaba como cartel de «cuántos planes hay» y mal como
 * diapositiva: en el feed, la primera imagen es la única que se ve antes de decidir si
 * se desliza, y un «6» gigante no dice de qué va el post.
 *
 * Lo que se imita de la cuenta de referencia del sector no es el estilo, es la función:
 * la primera diapositiva **enseña el mejor plan** —foto, título, sitio y fecha— porque
 * eso es lo que hace que alguien pare. El número sigue estando, pero como promesa
 * pequeña arriba a la derecha, que es donde informa sin ocupar el sitio del contenido.
 *
 * **La foto va con `objectFit: "cover"` aquí y con `contain` en las diapositivas de
 * evento, y la diferencia es deliberada.** En la portada el título se reescribe en
 * tipografía debajo, así que recortar el cartel original no pierde información. En una
 * diapositiva de evento el póster *es* el contenido: recortarlo corta el nombre del
 * grupo o la fecha que el cartel trae impresa, y eso es destruir el dato.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { fecha } = await params;

  // `ventanaDelDia` lanza si la fecha no es `YYYY-MM-DD`, y una URL vieja no puede
  // tumbar la imagen: sin ventana se usa ese mismo día, que es lo que hacía antes.
  let desde = fecha;
  let hasta = fecha;
  try {
    const ventana = ventanaDelDia(fecha);
    if (ventana) {
      desde = ventana.desde;
      hasta = ventana.hasta;
    }
  } catch {
    // La fecha del enlace no es una fecha. Se pinta lo que haya para ese día, y si no
    // hay nada el carrusel enseña el estado vacío en vez de un 502.
  }

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde, hasta, limite: MAX_DIAPOSITIVAS });
  const principal = lista[0];

  const imagen = urlImagenPromo(principal?.image);

  // Todo lo que se interpola se calcula aquí y se pinta como una sola cadena: un
  // ternario que pueda devolver número o cadena rompe Satori con un 502 sin cuerpo.
  const cuenta = String(lista.length);
  const promesa =
    lista.length === 0 ? "LA AGENDA" : `${cuenta} ${lista.length === 1 ? "PLAN" : "PLANES"}`;
  const cuando = ventanaCortaPromo(desde, hasta);
  const titulo = recortar(principal?.title ?? "La agenda sigue en marcha", 104);
  const sitio = recortar(principal?.location ?? "", 64);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PALETA_PROMO.papel,
          color: PALETA_PROMO.tinta,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <CabeceraPromo
          extra={
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 3,
                color: PALETA_PROMO.rojo,
              }}
            >
              {promesa}
            </div>
          }
        />

        <div
          style={{
            display: "flex",
            height: 1,
            background: PALETA_PROMO.filete,
            marginTop: 22,
            marginBottom: 30,
          }}
        />

        {imagen ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imagen}
            alt=""
            width={952}
            height={600}
            style={{ objectFit: "cover", borderRadius: 20, background: PALETA_PROMO.marco }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 952,
              height: 600,
              borderRadius: 20,
              background: PALETA_PROMO.marco,
            }}
          >
            <MarcaPromo tamano={280} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 30 }}>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 3,
              color: PALETA_PROMO.rojo,
            }}
          >
            EL MÁS RECOMENDADO
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 3,
              color: PALETA_PROMO.mostaza,
            }}
          >
            {cuando}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 54,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            marginTop: 14,
          }}
        >
          {titulo}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: PALETA_PROMO.tintaSuave,
            marginTop: 16,
          }}
        >
          {sitio}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: PALETA_PROMO.tintaSuave,
              marginBottom: 18,
            }}
          >
            Día, hora, sitio y precio de cada plan
          </div>
          <div
            style={{
              display: "flex",
              height: 1,
              background: PALETA_PROMO.filete,
              marginBottom: 20,
            }}
          />
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                color: PALETA_PROMO.tintaSuave,
              }}
            >
              Vitoria-Gasteiz
            </div>
            <div style={{ display: "flex", fontSize: 26, color: PALETA_PROMO.tintaSuave }}>
              gasteizclick.javierpalacio.es
            </div>
          </div>
        </div>
      </div>
    ),
    TAMANO_PROMO
  );
}

/**
 * Corta un texto largo por donde se pueda leer, con puntos suspensivos.
 *
 * **No es cosmética: el título de una diapositiva tiene tres líneas de sitio.** Un
 * título municipal de 140 caracteres a 54 px ocupa seis y empuja el pie fuera del
 * lienzo, y Satori no recorta: pinta lo que le des. Se corta aquí, en el último espacio
 * antes del límite, para no partir una palabra por la mitad.
 */
function recortar(texto: string, maximo: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= maximo) return limpio;

  const corte = limpio.slice(0, maximo);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return `${(ultimoEspacio > maximo / 2 ? corte.slice(0, ultimoEspacio) : corte).trimEnd()}…`;
}
