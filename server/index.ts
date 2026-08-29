import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { registerRoutes } from "./routes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 5000);

async function main() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  registerRoutes(app);

  if (isProd) {
    const clientDir = path.join(root, "dist/client");
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      configFile: path.join(root, "vite.config.ts"),
      server: { middlewareMode: true, hmr: { server: undefined } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Casa Studio listening on ${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
