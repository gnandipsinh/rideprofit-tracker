#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "fast-png";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeIcon(size, paddingFactor = 0.08) {
  const data = new Uint8ClampedArray(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - size * paddingFactor;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background navy #0b1422
      let red = 11;
      let green = 20;
      let blue = 34;
      const alpha = 255;

      // Outer gold circle stroke #f0b83f
      if (Math.abs(dist - r) < size * 0.035) {
        red = 240;
        green = 184;
        blue = 63;
      } else if (dist < r) {
        // Truck body #1374c5
        const normX = (x - cx) / r;
        const normY = (y - cy) / r;
        if (normY > -0.05 && normY < 0.35 && normX > -0.55 && normX < 0.25) {
          red = 19;
          green = 116;
          blue = 197;
        } else if (normY > -0.25 && normY < 0.35 && normX >= 0.25 && normX < 0.55) {
          red = 19;
          green = 116;
          blue = 197;
        }
        // Truck wheels gold #f0b83f
        const w1Dist = Math.hypot(normX - -0.25, normY - 0.42);
        const w2Dist = Math.hypot(normX - 0.35, normY - 0.42);
        if (w1Dist < 0.12 || w2Dist < 0.12) {
          red = 240;
          green = 184;
          blue = 63;
        }
      }

      data[idx] = red;
      data[idx + 1] = green;
      data[idx + 2] = blue;
      data[idx + 3] = alpha;
    }
  }

  return encode({ width: size, height: size, data });
}

fs.writeFileSync(path.join(ROOT, "public", "pwa-192x192.png"), makeIcon(192));
fs.writeFileSync(path.join(ROOT, "public", "pwa-512x512.png"), makeIcon(512));
fs.writeFileSync(path.join(ROOT, "public", "pwa-maskable-512x512.png"), makeIcon(512, 0.15));
fs.writeFileSync(path.join(ROOT, "public", "apple-touch-icon.png"), makeIcon(180));
console.log("PWA PNG icons generated successfully");
