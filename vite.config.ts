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
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-Requested-With, Content-Type, Authorization, Accept, Origin",
    );
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }
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
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: { preset: nitroPreset },
});
