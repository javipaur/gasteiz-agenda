/**
 * @jest-environment jsdom
 */

/**
 * Que el predicado de `lib/image-hosts.ts` **esté cableado** en la tarjeta.
 *
 * El test de `__tests__/image-hosts.test.ts` comprueba que el predicado decide bien, y
 * eso no basta: un predicado correcto al que nadie llama tampoco hace nada, y fue
 * exactamente lo que pasó en dos sitios durante el barrido del 4 de octubre de 2026 —la
 * ficha de `/evento/[slug]` y el hub de secciones seguían pintando `<Image src=
 * {evento.image}>` a pelo— sin que ningún test se enterara.
 *
 * **Lo que este test no puede comprobar**, y conviene no creer que comprueba: que la
 * página se caiga. Para eso haría falta el `next/image` de verdad, y este fichero lo
 * sustituye por un `<img>` sin más —ver el `jest.mock` de `helpers-a11y`—, que no
 * comprueba `remotePatterns` y por tanto no lanza nunca. Lo que sí se afirma aquí es la
 * mitad que está en este repo: que la tarjeta **no pide** la imagen cuando el host no es
 * servible. La otra mitad —que `next/image` lanza con una que no lo es— está en el
 * código de Next, y los dos sitios concretos están citados en el predicado.
 *
 * Que de degrade y no que se caiga es la promesa, y por eso el caso de un host
 * desconocido mira las dos cosas: que **no** hay `<img>` y que sí está el tile con la
 * inicial. Un `0` de imágenes también lo daría una tarjeta que no pinta nada, y eso no
 * es degradar: es desaparecer.
 */
import { escenario } from "../helpers-a11y";

type Modulo = { EventCard: (props: Record<string, unknown>) => unknown };

const BASE = {
  id: "e1",
  slug: "concierto-de-prueba",
  title: "Concierto de prueba",
  date: "2099-03-04",
  time: "20:00",
  location: "Sala Gimeno",
  link: "/evento/concierto-de-prueba",
  category: "Conciertos",
  source: "jimmyjazz",
};

function tarjetaCon(image: string) {
  const esc = escenario<Modulo>("@/lib/shared");
  const nodo = esc.crear(esc.modulo.EventCard, { evento: { ...BASE, image } });
  const vista = esc.montar(esc.conProviders(nodo));
  return { vista, ...esc };
}

describe("la tarjeta degrada en vez de romperse", () => {
  it("pinta la imagen cuando el host está en remotePatterns", () => {
    const { vista } = tarjetaCon("https://www.vitoria-gasteiz.org/cartel.jpg");
    expect(vista.consultarTodos("a img")).toHaveLength(1);
    vista.desmontar();
  });

  it("no pinta la imagen de un host desconocido, y pone el tile con la inicial", () => {
    // El host es real y no está en la lista. Es el caso del incidente: un solo evento
    // con un `www` de más tumbaba la home, `/culture` y `/agenda/[mes]`.
    const { vista } = tarjetaCon("https://cdn.desconocido.example/cartel.jpg");

    expect(vista.consultarTodos("img")).toHaveLength(0);
    // El tile con la inicial es lo que se ve cuando un evento no trae imagen, así que
    // es la degradación prometida y no un hueco. Sin esta segunda aserción, "no hay
    // imagen" y "no hay tarjeta" darían el mismo resultado.
    expect(vista.consultarTodos("span").some((s) => s.textContent === "C")).toBe(true);
    // Y el enlace al detalle sigue ahí: degradar la foto no puede costar el clic.
    expect(vista.consultarTodos("a[href='/evento/concierto-de-prueba']").length).toBeGreaterThan(0);

    vista.desmontar();
  });

  it("tampoco pinta una imagen en claro de un host que sí está en la lista", () => {
    // `next/image` compara `protocol` con `!==` contra el `remotePattern`, así que un
    // `http://` de La Genterula es tan servible como un host desconocido: no. El host
    // está en la lista a propósito, para que el test no dependa de acertar el host.
    const { vista } = tarjetaCon("http://www.gasteizhoy.com/wp-content/uploads/x.gif");

    expect(vista.consultarTodos("img")).toHaveLength(0);
    vista.desmontar();
  });
});