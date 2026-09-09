import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectDatabase } from "./config/db";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./utils/http";

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const configuredOrigins = process.env.CORS_ORIGIN?.trim();
if (isProduction && (!configuredOrigins || configuredOrigins === "*")) {
  throw new Error("CORS_ORIGIN must be an explicit frontend origin in production.");
}

const origins = (configuredOrigins ?? "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: origins, credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;

connectDatabase()
  .then(() => {
    app.listen(port, () => console.log(`[server] listening on http://localhost:${port}`));
  })
  .catch((err: unknown) => {
    console.error("[server] failed to start:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
