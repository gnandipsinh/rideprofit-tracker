import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = Boolean(
  process.env["VERCEL"] || process.env["VERCEL_ENV"] || process.env["NOW_BUILDER"],
);
const nitroPreset = process.env["NITRO_PRESET"] || (isVercel ? "vercel" : undefined);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(nitroPreset ? { nitro: { preset: nitroPreset } } : {}),
});
