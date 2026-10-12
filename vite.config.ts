import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const isVercel = Boolean(
  process.env["VERCEL"] || process.env["VERCEL_ENV"] || process.env["NOW_BUILDER"],
);
const nitroPreset = process.env["NITRO_PRESET"] || (isVercel ? "vercel" : undefined);

function apiMiddlewarePlugin(): Plugin {
  return {
    name: "api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith("/api")) {
          const { handleApiNode } = await import("./src/server/api");
          return handleApiNode(req, res);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [apiMiddlewarePlugin()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(nitroPreset ? { nitro: { preset: nitroPreset } } : {}),
});
