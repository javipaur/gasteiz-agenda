# Reel de Navidad 2026 en Vitoria-Gasteiz

**Este vídeo no se publica desde el repositorio.** Lo genera el proyecto, lo
descarga n8n y lo sube una persona. No hay token de Instagram aquí y no habrá
publicación automática. La música **no va dentro del MP4**: se añade desde
Instagram, que es donde está la licencia.

## Cómo se regenera

```bash
npm run reel:navidad
```

Sale `public/navidad-2026/reel.mp4`: **1080×1920, 30 fps, 16 s, sin audio**.
El propio script lo comprueba con `ffprobe-static` y falla si no mide entre 15
y 20 s o si lleva una pista de audio. Los datos, las fuentes y la fecha de
consulta salen de `lib/navidad-vitoria.ts`; no hay texto del reel escrito en
este documento ni en la ruta que lo sirve.

## Ritmo

Los cortes van a **120 bpm**: un plano nuevo cada medio segundo, cuatro
latidos por plan, ocho planes. El gancho ocupa los primeros 2 segundos y es la
misma diapositiva 1 con la barra de progreso avanzando; no se pierde tiempo en
una portada que no muestra ningún plan.

| Tiempo | Plano | Texto en pantalla | Fuente | Voz (opcional) |
| --- | --- | --- | --- | --- |
| `0:00`–`0:02` | 1 · Encendido | «La Navidad enciende Vitoria» · 26 de noviembre · Plaza de España | Ayuntamiento, 25-nov-2026 | «Mañana encienden Vitoria.» |
| `0:02`–`0:04` | 2 · Chocolatada | «Chocolatada gratis» · 700 raciones después del encendido | Ayuntamiento y GasteizBerri, 26-nov-2026 | «Y hay chocolate caliente.» |
| `0:04`–`0:06` | 3 · Árbol | «Un árbol de 13 metros» · Novedad de 2026 · Plaza de España | Ayuntamiento, 25-nov-2026 | «Un árbol nuevo, de 13 metros.» |
| `0:06`–`0:08` | 4 · Corte Inglés | «La Navidad llega al centro» · 26-nov · 19:00–20:00 · Plaza de María Sarmiento | El Corte Inglés Vitoria, 26-nov-2026 | «Olentzero también pasa por el centro.» |
| `0:08`–`0:10` | 5 · Noria | «Noria y carrusel» · Virgen Blanca y Arca · 18:00–22:00 · precio por confirmar | Calendario municipal, 26-nov-2026 | «La noria abre tras el encendido.» |
| `0:10`–`0:12` | 6 · Belén | «Belén monumental» · +200 figuras · desde 1962 · donativo | Ayuntamiento, 19-nov-2026 | «El belén de La Florida vuelve.» |
| `0:12`–`0:14` | 7 · Horra! | «Horra! El bosque» · Jardines de Zulueta · 4–27 de diciembre | Noticias de Álava, 26-nov-2026 | «Y el bosque de Olentzero.» |
| `0:14`–`0:16` | 8 · Lan ta lan | «Mercados de Navidad» · Lan ta lan · 14 dic–5 ene · Plaza de la Provincia | Calendario municipal, 26-nov-2026 | «Y mercados hasta Reyes.» |

Cada plano lleva visible su fuente y el aviso **«Consulta cambios en la web
oficial»**, que es el mismo `AVISO_CAMBIOS` que el carrusel y el paquete n8n.
Lo que no tiene dato para 2026 se pinta como **POR CONFIRMAR** y no se rellena
con la edición anterior.

### Locución

La voz es opcional: el MP4 se entrega sin audio y cada plano aguanta su texto
en pantalla. Si se añade, que sea en español de España, a un ritmo de una
frase corta por plano, y con el último plano cerrando en «hasta Reyes». La
música se elige en Instagram y se baja al nivel de la voz; no se incrusta en
el vídeo para que no haya que justificar aquí una licencia que no tenemos.

## Antes de subirlo

1. Comprobar en la web oficial cada plan del cuadro; la fecha de consulta es
   el 26 de noviembre de 2026 y los datos pueden haber cambiado.
2. Mirar el MP4 en un teléfono: **REVISAR A OJO** — el generador verifica
   tamaño, duración y ausencia de audio, pero no puede ver si el texto se lee
   bien ni si la marca queda centrada.
3. Añadir la música desde Instagram. Publicar solo si una persona decide que
   el día merece publicarse.
