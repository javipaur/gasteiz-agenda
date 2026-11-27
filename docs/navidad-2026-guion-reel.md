# Reel de Navidad 2026 en Vitoria-Gasteiz

**Este vídeo no se publica desde el repositorio.** Lo genera el proyecto, lo
descarga n8n y lo publica el workflow de Instagram. La decisión de si la
campaña sale sigue siendo de una persona; aquí no vive ningún token. La música
**no va dentro del MP4**: se añade desde Instagram, que es quien tiene la
licencia.

## Cómo se regenera

```bash
npm run reel:navidad
```

Sale `public/navidad-2026/reel.mp4`: **1080×1920, 30 fps, 26 s, sin audio**.
El propio script lo comprueba con `ffprobe-static` y falla si no mide entre 24
y 30 s o si lleva una pista de audio. Los datos, las fuentes y la fecha de
consulta salen de `lib/navidad-vitoria.ts`; el orden y las etiquetas de los
planos del reel salen de `lib/navidad-reel.ts`. No hay texto del reel escrito
en este documento ni en la ruta que lo sirve.

## Ritmo

Los cortes van a **120 bpm**: un plano nuevo cada medio segundo, cuatro
latidos por plan, **13 planos** —uno por evento de la agenda de Navidad, no
solo los ocho del carrusel—. El gancho ocupa los primeros 2 segundos y es la
misma diapositiva 1 con la barra de progreso avanzando. Cada plano enseña la
**fecha de inicio** y la **hora de inicio** del evento, sin usar las del año
anterior.

| Tiempo | Plano | Fecha de inicio | Hora de inicio |
| --- | --- | --- | --- |
| `0:00`–`0:02` | 1 · Encendido de las luces | 26 de noviembre | 17:30 |
| `0:02`–`0:04` | 2 · Chocolatada popular | 26 de noviembre | POR CONFIRMAR |
| `0:04`–`0:06` | 3 · Árbol luminoso | 26 de noviembre | POR CONFIRMAR |
| `0:06`–`0:08` | 4 · Luces de Navidad | 26 de noviembre | POR CONFIRMAR |
| `0:08`–`0:10` | 5 · Noria y carrusel | 26 de noviembre | 18:00 |
| `0:10`–`0:12` | 6 · Inauguración en El Corte Inglés | 26 de noviembre | 19:00 |
| `0:12`–`0:14` | 7 · Belén monumental de La Florida | 4 de diciembre | 18:00 |
| `0:14`–`0:16` | 8 · Belenes del Carmen | POR CONFIRMAR | POR CONFIRMAR |
| `0:16`–`0:18` | 9 · Horra! El bosque | 4 de diciembre | 18:00 |
| `0:18`–`0:20` | 10 · Pista de hielo | 11 de diciembre | 10:30 |
| `0:20`–`0:22` | 11 · Feria Lan ta lan | 14 de diciembre | 11:00 |
| `0:22`–`0:24` | 12 · Mercado agrícola | 17 de diciembre | 09:00 |
| `0:24`–`0:26` | 13 · Mercado navideño | 15 de diciembre | 10:30 |

Cada plano lleva visible su fuente, el lugar, el precio y el aviso **«Consulta
cambios en la web oficial»**, que es el mismo `AVISO_CAMBIOS` que el carrusel y
el paquete n8n. Lo que no tiene dato para 2026 se pinta como **POR CONFIRMAR**
y no se rellena con la edición anterior. Los rangos de fecha y hora de cierre
se enseñan como «Hasta el…» y «Hasta las…», sin quitarle sitio a la hora de
inicio.

### Locución

La voz es opcional: el MP4 se entrega sin audio y cada plano aguanta su texto
en pantalla. Si se añade, que sea en español de España, a un ritmo de una
frase corta por plano, y con el último plano cerrando en «hasta Reyes». La
música se elige en Instagram y se baja al nivel de la voz; no se incrusta en
el vídeo para que no haya que justificar aquí una licencia que no tenemos.

## Antes de publicarlo

1. Comprobar en la web oficial cada plan del cuadro; la fecha de consulta es
   el 26 de noviembre de 2026 y los datos pueden haber cambiado.
2. Mirar el MP4 en un teléfono: **REVISAR A OJO** — el generador verifica
   tamaño, duración y ausencia de audio, pero no puede ver si el texto se lee
   bien ni si la marca queda centrada.
3. Añadir la música desde Instagram. Publicar solo si una persona decide que
   el día merece publicarse.
