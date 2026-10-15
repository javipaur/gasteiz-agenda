import type { Metadata } from "next";
import Panel from "./Panel";

/**
 * El panel de métricas, y por qué la página se sirve **vacía**.
 *
 * Hay una tensión real aquí y conviene escribirla antes de que alguien la
 * "optimice": el contador que se enseña en `/api/metric` exige `x-api-key`, pero
 * un panel tiene que poder existir. Las tres salidas eran:
 *
 * 1. **Autenticación en el servidor** (middleware, Basic Auth, sesión). Es lo
 *    correcto en un panel de verdad y es desproporcionado aquí: sería el primer
 *    sistema de auth del repositorio para leer cinco números, y en un sitio que
 *    no tiene usuarios ni sesiones.
 * 2. **Servir los números en el HTML** y protegerlos con un `noindex`. No.index no
 *    es control de acceso: la página sigue siendo pública para cualquiera que
 *    conozca la dirección, y los recuentos de visitas son justo el dato que no
 *    tiene por qué ser público.
 * 3. **La que se ha elegido**: la página se sirve sin números y el navegador de
 *    quien la abre pregunta con la clave que **él** teclea. La clave no se publica
 *    en ningún bundle, no se guarda en `localStorage` —está en el estado del
 *    componente y se pierde al recargar—, y sin ella no hay nada que ver.
 *
 * El coste de la 3 es que hay que teclear la clave, y la ventaja es que no
 * introduces un sistema de identidad en un repositorio que no lo tiene. Si algún
 * día aparece un panel que hay que mirar a diario, la respuesta pasa a ser la 1 y
 * esta página se queda como atajo.
 */
export const metadata: Metadata = {
  title: "Métricas",
  // Por si acaso: aunque la página venga vacía, que no la indexe nadie.
  robots: { index: false, follow: false },
};

export default function PaginaMetricas() {
  return (
    // `pt-28` por el mismo motivo que el resto de páginas: la `Header` es fija.
    <div className="px-5 sm:px-6 pt-28 md:pt-32 pb-24 max-w-4xl mx-auto">
      <header className="mb-8 md:mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg tracking-[-0.02em]">
          Visitas e instalaciones
        </h1>
        <p className="text-fg-muted leading-relaxed mt-3 max-w-2xl">
          Lectura del contador propio. Los números no se sirven con la página: se
          piden al abrirla, con la clave que te pida. Sin cookies ni huellas, así
          que <strong className="text-fg">una visita cuenta una pestaña</strong>, no
          una persona.
        </p>
      </header>

      <Panel />
    </div>
  );
}