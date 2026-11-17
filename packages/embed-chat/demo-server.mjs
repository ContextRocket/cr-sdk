#!/usr/bin/env node
/**
 * Local demo server for the embed chat widget.
 *
 * Serves exactly two routes and nothing else, so the demo can never shadow
 * another local server or hijack unrelated paths:
 *
 *   /                → demo.html  (branded demo page)
 *   /embed/widget.js → dist/widget.js (the built bundle)
 *
 * Usage: npm run demo  (or: node demo-server.mjs [port])
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 3106;

const ROUTES = new Map([
  ["/", { file: resolve(__dirname, "demo.html"), type: "text/html; charset=utf-8" }],
  ["/embed/widget.js", { file: resolve(__dirname, "dist/widget.js"), type: "text/javascript; charset=utf-8" }],
]);

const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  const route = ROUTES.get(path);
  if (!route) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found. The demo server serves / and /embed/widget.js only.\n");
    return;
  }
  try {
    const body = await readFile(route.file);
    res.writeHead(200, { "content-type": route.type });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(
      `Cannot read ${route.file}. Build the bundle first: npm run build in packages/embed-chat.\n`,
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Embed widget demo: http://localhost:${port}/`);
});
