import fs from "fs/promises";
import path from "path";

export type Coords = { lat: number; lng: number };

const memCache = new Map<string, unknown>();

export async function getCurated<T>(relPath: string): Promise<T> {
  if (memCache.has(relPath)) return memCache.get(relPath) as T;
  const filePath = path.join(process.cwd(), "data", relPath);
  const raw = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as T;
  memCache.set(relPath, data);
  return data;
}

export function mapsLink(coords?: Coords): string | undefined {
  if (!coords) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
}