import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const isVercel = Boolean(
  process.env["VERCEL"] || process.env["VERCEL_ENV"] || process.env["NOW_BUILDER"],
);
const isCloudflare = Boolean(
  process.env["CLOUDFLARE"] || process.env["CF_PAGES"] || process.env["WORKERS"],
);
const nitroPreset =
  process.env["NITRO_PRESET"] ||
  (isVercel ? "vercel" : isCloudflare ? "cloudflare-module" : "node-server");

function apiMiddlewarePlugin(): Plugin {
  const handler = async (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
    next: () => void,
  ) => {
    if (req.url && req.url.startsWith("/api")) {
      const { handleApiNode } = await import("./src/server/api");
      return handleApiNode(req, res);
    }
    next();
  };

  return {
    name: "api-middleware",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [apiMiddlewarePlugin()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: { preset: nitroPreset },
});
