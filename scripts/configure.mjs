import { readFileSync, writeFileSync } from "node:fs";
const url = new URL(process.env.NIMBUS_SERVICE_URL || "invalid:");
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !process.env.PUBLIC_KEY
)
  throw Error("HTTPS service origin and public signing key are required");
const file = "src-tauri/tauri.conf.json",
  config = JSON.parse(readFileSync(file, "utf8"));
config.plugins.updater.pubkey = process.env.PUBLIC_KEY.trim();
writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
writeFileSync(
  "src-tauri/ci.bundle.json",
  JSON.stringify({ bundle: { createUpdaterArtifacts: false } }),
);
