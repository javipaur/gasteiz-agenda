
    //const url = `https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet?accion=buscar&idioma=es&calendariosID=196&fd=${fd}&fh=${fh}`;

    import { NextResponse } from "next/server";
    
    function extractSrcsetFromPicture(picture: string): string | null {
      if (!picture) return null;
    
      const webp = picture.match(
        /<source[^>]+type=['"]image\/webp['"][^>]+srcset=['"]([^'"]+)['"]/
      );
      if (webp) return webp[1];
    
      const jpeg = picture.match(
        /<source[^>]+type=['"]image\/jpeg['"][^>]+srcset=['"]([^'"]+)['"]/
      );
      if (jpeg) return jpeg[1];
    
      return null;
    }
    
    function transformImageUrl(url?: string): string | null {
      if (!url) return null;
      return url.replace(/_smart\.(webp|jpg|jpeg)$/i, "_smar.jpg");
    }
    
    function normalizeEvento(evento: any) {
      const extractedPicture = extractSrcsetFromPicture(evento.picture);
      const image =
        transformImageUrl(evento.imagen) ||
        transformImageUrl(extractedPicture ?? undefined);
    
      const fullImage = image ? "https://www.vitoria-gasteiz.org".concat(image) : null;
      return {
        title: evento.titulo ?? "",
        date: evento.datetime ?? "",
        image: fullImage,
        location: evento.localizacion ?? "",
        link: evento.url ?? "",
      };
    }
    
    export async function GET(request: Request) {
     //     const apiKey = request.headers.get("Authorization");
  /*if (!apiKey || apiKey !== process.env.API_KEY) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }*/

      try {
        const hoy = new Date();
        const inicio = new Date(hoy);
        inicio.setHours(0, 0, 0, 0);
    
        const fin = new Date(hoy);
        fin.setFullYear(fin.getFullYear() + 1);
    
        const fd = inicio.getTime();
        const fh = fin.getTime();
    
       const url = `https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet?accion=buscar&idioma=es&calendariosID=196&fd=${fd}&fh=${fh}`;

        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
    
        const eventos: any[] = Object.values(data || {})
          .reduce((acc: any[], seccion: any) => {
            if (seccion?.resultados) acc.push(...seccion.resultados);
            return acc;
          }, [])
          .map(normalizeEvento);
    
        return NextResponse.json(eventos);
    
      } catch (error) {
        return NextResponse.json(
          { error: "Error al consultar eventos" },
          { status: 500 }
        );
      }
    }