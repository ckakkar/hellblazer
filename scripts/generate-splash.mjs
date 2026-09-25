import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Generates iOS PWA launch screens (apple-touch-startup-image): true black with
// the flame mark centred, so tapping the home-screen icon shows Fatty
// instead of a white flash. Mirrors BootSplash exactly (same black, same mark,
// same 44pt size) so the hand-off from launch image to app is invisible.
const __dirname = dirname(fileURLToPath(import.meta.url));

const BG = "#000000";
const ACCENT = "#df2d28";
/** Mark size in CSS points; must match BootSplash. */
const MARK_PT = 44;
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

function svg(w, h, dpr) {
  const size = MARK_PT * dpr;
  const scale = size / 24;
  const x = w / 2 - size / 2;
  const y = h / 2 - size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <g transform="translate(${x} ${y}) scale(${scale})"><path d="${FLAME}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;
}

const outDir = join(__dirname, "..", "public", "splash");
mkdirSync(outDir, { recursive: true });

const links = [];
for (const d of DEVICES) {
  const file = `splash-${d.w}x${d.h}.png`;
  await sharp(Buffer.from(svg(d.w, d.h, d.dpr)))
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
