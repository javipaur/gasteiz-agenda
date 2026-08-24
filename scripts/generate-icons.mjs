import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

const PUBLIC = path.join(process.cwd(), "public");
const svg = await readFile(path.join(PUBLIC, "icon-512.svg"));

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(svg, { density: 300 })
    .resize(t.size, t.size)
    .png()
    .toFile(path.join(PUBLIC, t.name));
  console.log(`OK ${t.name} (${t.size}x${t.size})`);
}

const maskableSvg = await readFile(path.join(PUBLIC, "icon-maskable.svg"));
await sharp(maskableSvg, { density: 300 })
  .resize(512, 512)
  .png()
  .toFile(path.join(PUBLIC, "icon-maskable-512.png"));
console.log("OK icon-maskable-512.png (512x512)");
