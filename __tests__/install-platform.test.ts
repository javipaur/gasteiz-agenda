import { esIOS, metodoDeInstalacion, muestraAppNativa } from "@/lib/install";

/**
 * Esto vive en `lib/install.ts` y no dentro de un componente **por eso** está
 * aquí y no en `__tests__/components/`: las user agent de verdad no se
 * fabrican en jsdom sin montar un navigator entero, y este fichero es puro a
 * propósito. Un componente que calculase la rama con su propio `navigator`
 * pasaría los casos fáciles y no podría cubrir el iPad cancelado.
 */

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
/** iPadOS 13+ en Modo Escritorio: se anuncia como Mac y solo el táctil lo delata. */
const IPAD_EN_ESCRITORIO =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const FIREFOX_ESCRITORIO =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
const SAFARI_ESCRITORIO =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

describe("esIOS", () => {
  it("reconoce iPhone, iPad e iPod por user agent", () => {
    expect(esIOS(IPHONE, 5)).toBe(true);
    expect(esIOS(IPAD, 5)).toBe(true);
    expect(esIOS("Mozilla/5.0 (iPod touch; CPU OS 17_0 like Mac OS X) Safari/604.1", 5)).toBe(
      true
    );
  });

  it("reconoce el iPad en Modo Escritorio, que se anuncia como un Mac", () => {
    // Sin el táctil no hay nada que lo separe de un Mac, y es justo por eso por
    // lo que el caso existe: si esto devuelve false, el iPad de quien usa un
    // teclado físico cae en la rama de escritorio y se le ofrece un botón que
    // en su navegador nunca va a funcionar.
    expect(esIOS(IPAD_EN_ESCRITORIO, 5)).toBe(true);
  });

  it("no confunde un Mac con el iPad", () => {
    // El guardia de `Macintosh` es lo que evita este falso positivo: el mismo
    // user agent con cero puntos táctiles es un portátil de verdad.
    expect(esIOS(IPAD_EN_ESCRITORIO, 0)).toBe(false);
    expect(esIOS(MAC, 0)).toBe(false);
  });

  it("no confunde un portátil con pantalla táctil de otro sistema", () => {
    expect(
      esIOS("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0", 10)
    ).toBe(false);
    expect(
      esIOS("Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36", 10)
    ).toBe(false);
  });

  it("no dice que sí a Android, que también es táctil", () => {
    expect(esIOS(ANDROID_CHROME, 5)).toBe(false);
  });
});

describe("metodoDeInstalacion", () => {
  const entrada = (over: Partial<Parameters<typeof metodoDeInstalacion>[0]>) => ({
    userAgent: ANDROID_CHROME,
    maxTouchPoints: 5,
    instalado: false,
    eventoDisponible: false,
    ...over,
  });

  it("a quien ya la tiene instalada no se le ofrece nada", () => {
    // Lo primero, y por encima de todo: `instalado` gana a las cuatro ramas.
    expect(metodoDeInstalacion(entrada({ instalado: true }))).toBe(
      "ya-instalada"
    );
  });

  it("en iOS da los pasos, porque Safari no dispara el evento", () => {
    // El caso que motiva el módulo entero. Antes, todo el UI de instalación
    // dependía de `beforeinstallprompt` y en un iPhone no se pintaba nunca.
    expect(metodoDeInstalacion(entrada({ userAgent: IPHONE }))).toBe(
      "instrucciones-ios"
    );
  });

  it("en iOS da los pasos aunque algún día llegue el evento", () => {
    // Hoy los dos órdenes son el mismo, porque en iOS no hay evento que
    // preferir. Fijarlo documenta cuál valdría si WebKit cambiara.
    expect(
      metodoDeInstalacion(entrada({ userAgent: IPHONE, eventoDisponible: true }))
    ).toBe("instrucciones-ios");
  });

  it("en Chromium con evento da un botón de verdad", () => {
    expect(
      metodoDeInstalacion(entrada({ eventoDisponible: true }))
    ).toBe("navegador");
  });

  it("en Firefox y Safari de escritorio cae a instrucciones genéricas", () => {
    // Ninguno de los dos dispara `beforeinstallprompt`, y sin él el camino
    // corto de "hazle clic a Instalar" no existe.
    expect(metodoDeInstalacion(entrada({ userAgent: FIREFOX_ESCRITORIO }))).toBe(
      "instrucciones-genericas"
    );
    expect(metodoDeInstalacion(entrada({ userAgent: SAFARI_ESCRITORIO, maxTouchPoints: 0 }))).toBe(
      "instrucciones-genericas"
    );
  });

  it("en servidor, donde no hay navigator, no se inventa un iPhone", () => {
    // `userAgent` vacío y cero puntos táctiles dan un iPhone falso, y eso
    // elegiría las instrucciones de iOS para todo el mundo en el primer render.
    expect(
      metodoDeInstalacion(entrada({ userAgent: "", maxTouchPoints: 0 }))
    ).toBe("instrucciones-genericas");
  });
});

describe("muestraAppNativa", () => {
  const entrada = (over: Partial<Parameters<typeof muestraAppNativa>[0]>) => ({
    userAgent: ANDROID_CHROME,
    maxTouchPoints: 5,
    instalado: false,
    eventoDisponible: false,
    ...over,
  });

  it("se muestra en Android, que es donde la PWA compite con ella", () => {
    expect(muestraAppNativa(entrada({}))).toBe(true);
  });

  it("no se muestra en iOS, donde Play Store no instala nada", () => {
    expect(muestraAppNativa(entrada({ userAgent: IPHONE }))).toBe(false);
  });

  it("no se muestra a quien ya tiene la PWA instalada", () => {
    expect(muestraAppNativa(entrada({ instalado: true }))).toBe(false);
  });
});