import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Generates iOS PWA launch screens (apple-touch-startup-image) — a dark,
// on-brand splash so tapping the home-screen icon shows Hell Blazer instead of
// a blank white flash while the app cold-starts. Uses the default crimson hue.
const __dirname = dirname(fileURLToPath(import.meta.url));

const BG = "#0a0908";
const ACCENT = "#ff2d3a";
const TEXT = "#efece8";
// lucide "flame"
const FLAME =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

// portrait: image px (w,h) + CSS device dims (dw,dh) + dpr for the media query
const DEVICES = [
  { w: 1290, h: 2796, dw: 430, dh: 932, dpr: 3 }, // 14/15 Pro Max
  { w: 1320, h: 2868, dw: 440, dh: 956, dpr: 3 }, // 16 Pro Max
  { w: 1206, h: 2622, dw: 402, dh: 874, dpr: 3 }, // 16 Pro
  { w: 1284, h: 2778, dw: 428, dh: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 1179, h: 2556, dw: 393, dh: 852, dpr: 3 }, // 14/15 Pro
  { w: 1170, h: 2532, dw: 390, dh: 844, dpr: 3 }, // 12/13/14/15
  { w: 1125, h: 2436, dw: 375, dh: 812, dpr: 3 }, // X/XS/11 Pro/mini
  { w: 1242, h: 2688, dw: 414, dh: 896, dpr: 3 }, // XS Max/11 Pro Max
  { w: 828, h: 1792, dw: 414, dh: 896, dpr: 2 }, // XR/11
  { w: 750, h: 1334, dw: 375, dh: 667, dpr: 2 }, // SE/8
];

function svg(w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const sq = Math.round(Math.min(w, h) * 0.19);
  const sqx = cx - sq / 2;
  const sqy = cy - sq * 1.15;
  const rx = Math.round(sq * 0.24);
  const fscale = (sq * 0.52) / 24;
  const fx = cx - 12 * fscale;
  const fy = sqy + sq / 2 - 12 * fscale;
  const wordY = sqy + sq + Math.round(sq * 0.6);
  const fs = Math.round(sq * 0.26);
  const barW = Math.round(sq * 1.5);
  const barY = wordY + Math.round(sq * 0.5);
  const barH = Math.max(3, Math.round(sq * 0.028));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <defs><radialGradient id="g" cx="50%" cy="40%" r="60%">
    <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.14"/>
    <stop offset="72%" stop-color="${ACCENT}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="${sqx}" y="${sqy}" width="${sq}" height="${sq}" rx="${rx}" fill="${ACCENT}"/>
  <g transform="translate(${fx} ${fy}) scale(${fscale})"><path d="${FLAME}" fill="${BG}"/></g>
  <text x="${cx}" y="${wordY}" fill="${TEXT}" font-family="Helvetica, Arial, sans-serif" font-size="${fs}" font-weight="700" letter-spacing="${(fs * 0.22).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">HELL BLAZER</text>
  <rect x="${cx - barW / 2}" y="${barY}" width="${barW}" height="${barH}" rx="${barH}" fill="${ACCENT}" opacity="0.85"/>
</svg>`;
}

const outDir = join(__dirname, "..", "public", "splash");
mkdirSync(outDir, { recursive: true });

const links = [];
for (const d of DEVICES) {
  const file = `splash-${d.w}x${d.h}.png`;
  await sharp(Buffer.from(svg(d.w, d.h)))
    .png()
    .toFile(join(outDir, file));
  links.push({
    url: `/splash/${file}`,
    media: `screen and (device-width: ${d.dw}px) and (device-height: ${d.dh}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)`,
  });
  console.log("✓", file);
}

// Emit the metadata array for pasting into the root layout.
writeFileSync(
  join(outDir, "startup-image.json"),
  JSON.stringify(links, null, 2),
);
console.log("\nstartupImage config → public/splash/startup-image.json");
