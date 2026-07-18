import express from "express";
import { tracesRouter } from "./routes/traces.js";
import { spansRouter } from "./routes/spans.js";
import { analyticsRouter } from "./routes/analytics.js";

const app = express();
app.use(express.json());
app.use(tracesRouter);
app.use(spansRouter);
app.use(analyticsRouter);

const PORT = process.env.PORT ?? 3080;

if (process.env.NODE_ENV === "production") {
  const { resolve } = await import("node:path");
  app.use(express.static(resolve(import.meta.dirname, "../dist")));
  app.get("*", (_req, res) => {
    res.sendFile(resolve(import.meta.dirname, "../dist/index.html"));
  });
} else {
  const { resolve } = await import("node:path");
  const { createServer } = await import("vite");
  const vite = await createServer({
    root: resolve(import.meta.dirname, ".."),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
