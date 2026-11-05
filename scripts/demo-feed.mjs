import { createServer } from "node:http";
import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
// Loopback-only test server. No production client is built with this address.
const root = resolve(process.argv[2] || "../../demo"),
  port = Number(process.env.DEMO_PORT || 18743);
mkdirSync(root, { recursive: true });
createServer((req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  appendFileSync(
    resolve(root, "requests.jsonl"),
    JSON.stringify({ at: new Date().toISOString(), path }) + "\n",
  );
  if (path.startsWith("/updates/")) {
    if (!existsSync(resolve(root, "enabled")) || path.endsWith("/1.0.1")) {
      res.writeHead(204);
      return res.end();
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(readFileSync(resolve(root, "release.json")));
  }
  if (path === "/installer.exe") {
    const bytes = readFileSync(
      resolve(root, "CorelumNetwork_1.0.1_x64-setup.exe"),
    );
    res.setHeader("Content-Length", bytes.length);
    res.setHeader("Content-Type", "application/octet-stream");
    if (existsSync(resolve(root, "interrupt-once"))) {
      const n = Math.floor(bytes.length / 3);
      res.write(bytes.subarray(0, n));
      setTimeout(() => res.destroy(), 150);
      return;
    }
    res.end(bytes);
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(port, "127.0.0.1", () =>
  console.log("Loopback demo feed listening on " + port),
);
