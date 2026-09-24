import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Generates the native iOS app icon and launch-screen mark from the same
// flame as the PWA icons, so the app and the home-screen PWA look identical.
// Run after changing the mark: node scripts/generate-ios-assets.mjs
const __dirname = dirname(fileURLToPath(import.meta.url));
const assets = join(__dirname, "..", "ios", "App", "App", "Assets.xcassets");

// Sampled from src/app/apple-icon.png.
const ICON_BG = "#0a0908";
const ICON_FLAME = "#ff2d3a";
// Matches BootSplash and scripts/generate-splash.mjs.
const SPLASH_FLAME = "#df2d28";
/** Launch mark size in points; must match BootSplash (MARK_PT). */
const MARK_PT = 44;
// lucide "flame", drawn on a 24-unit box.
const FLAME =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z";

function flame(size, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${FLAME}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// App icon: 1024 square, full bleed (iOS applies its own corner mask), no
// alpha channel (App Store Connect rejects icons with one). The flame box is
// 58% of the icon, the same proportion as apple-icon.png.
const ICON = 1024;
const box = Math.round(ICON * 0.58);
await sharp({ create: { width: ICON, height: ICON, channels: 3, background: ICON_BG } })
  .composite([{ input: Buffer.from(flame(box, ICON_FLAME)), gravity: "centre" }])
  .flatten({ background: ICON_BG })
  .removeAlpha()
  .png()
  .toFile(join(assets, "AppIcon.appiconset", "AppIcon-512@2x.png"));
console.log("✓ AppIcon 1024");

// Launch screen: the mark alone on transparent; LaunchScreen.storyboard
// centres it at 44pt on true black.
const images = [];
for (const scale of [1, 2, 3]) {
  const file = `splash-mark@${scale}x.png`;
  await sharp(Buffer.from(flame(MARK_PT * scale, SPLASH_FLAME)))
    .png()
    .toFile(join(assets, "Splash.imageset", file));
  images.push({ idiom: "universal", filename: file, scale: `${scale}x` });
  console.log("✓", file);
}
writeFileSync(
  join(assets, "Splash.imageset", "Contents.json"),
  JSON.stringify({ images, info: { version: 1, author: "xcode" } }, null, 2) + "\n",
);
