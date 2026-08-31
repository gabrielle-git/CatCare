import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");

const BRAND = "#8e7dbe";
const PAW = "#ffffff";

function iconSvg(size) {
  const pad = size * 0.18;
  const r = size * 0.12;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${BRAND}"/>
  <g fill="${PAW}">
    <ellipse cx="${size * 0.5}" cy="${size * 0.62}" rx="${size * 0.14}" ry="${size * 0.11}"/>
    <circle cx="${size * 0.34}" cy="${size * 0.42}" r="${size * 0.055}"/>
    <circle cx="${size * 0.44}" cy="${size * 0.36}" r="${size * 0.05}"/>
    <circle cx="${size * 0.56}" cy="${size * 0.36}" r="${size * 0.05}"/>
    <circle cx="${size * 0.66}" cy="${size * 0.42}" r="${size * 0.055}"/>
  </g>
</svg>`;
}

async function writePng(name, size) {
  await sharp(Buffer.from(iconSvg(size))).png().toFile(path.join(outDir, name));
}

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "icon.svg"), iconSvg(512), "utf8");
await Promise.all([
  writePng("icon-192.png", 192),
  writePng("icon-512.png", 512),
  writePng("apple-touch-icon.png", 180),
  writePng("favicon-32.png", 32),
]);

console.log("PWA icons generated in public/icons/");
