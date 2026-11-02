import sharp from "sharp";

/**
 * Meta's Instagram Content Publishing API only accepts JPEG images.
 * The existing promo routes stay PNG by default; n8n opts in with `?format=jpeg`.
 */
export async function paraInstagramJpeg(request: Request, image: Response): Promise<Response> {
  if (new URL(request.url).searchParams.get("format") !== "jpeg" || !image.ok) {
    return image;
  }

  const jpeg = await sharp(Buffer.from(await image.arrayBuffer()))
    .jpeg({ quality: 90 })
    .toBuffer();
  const headers = new Headers(image.headers);
  headers.set("Content-Type", "image/jpeg");
  headers.delete("Content-Length");

  return new Response(Uint8Array.from(jpeg), {
    status: image.status,
    statusText: image.statusText,
    headers,
  });
}
