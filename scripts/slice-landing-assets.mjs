import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const input = "public/assets/aistudio/file_00000000780081fab7e7474b6663de01_9eaf169b.png";
const outDir = "public/assets/landing";
fs.mkdirSync(outDir, { recursive: true });

async function slice() {
  const meta = await sharp(input).metadata();
  console.log("Source dimensions:", meta.width, "x", meta.height);

  // 1. Hero right showcase (Truck + Dashboard)
  await sharp(input)
    .extract({ left: 470, top: 75, width: 520, height: 350 })
    .png({ quality: 95 })
    .toFile(path.join(outDir, "hero-showcase.png"));
  console.log("Created hero-showcase.png");

  // 1b. Hero blue electric truck alone
  await sharp(input)
    .extract({ left: 480, top: 110, width: 175, height: 250 })
    .png({ quality: 95 })
    .toFile(path.join(outDir, "hero-truck.png"));
  console.log("Created hero-truck.png");

  // 2. How it works laptop + mobile device mockup
  await sharp(input)
    .extract({ left: 570, top: 725, width: 420, height: 235 })
    .png({ quality: 95 })
    .toFile(path.join(outDir, "devices-mockup.png"));
  console.log("Created devices-mockup.png");

  // 3. Bottom CTA Truck on highway
  await sharp(input)
    .extract({ left: 52, top: 1350, width: 310, height: 130 })
    .png({ quality: 95 })
    .toFile(path.join(outDir, "cta-truck.png"));
  console.log("Created cta-truck.png");

  // 4. Testimonial Avatars
  await sharp(input)
    .extract({ left: 63, top: 1125, width: 62, height: 62 })
    .png({ quality: 95 })
    .toFile(path.join(outDir, "avatar-1.png"));
  await sharp(input)
    .extract({ left: 374, top: 1125, width: 62, height: 62 })
    .png({ quality: 95 })
    .toFile(path.join(outDir, "avatar-2.png"));
  await sharp(input)
    .extract({ left: 678, top: 1125, width: 62, height: 62 })
    .png({ quality: 95 })
    .toFile(path.join(outDir, "avatar-3.png"));
  console.log("Created avatars");

  // 5. Small highway truck (feature section accent)
  await sharp(input)
    .extract({ left: 850, top: 440, width: 140, height: 95 })
    .png({ quality: 95 })
    .toFile(path.join(outDir, "feature-truck.png"));
  console.log("Created feature-truck.png");
}

slice().catch(console.error);
