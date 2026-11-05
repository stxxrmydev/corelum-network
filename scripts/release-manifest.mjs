import { readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
const {
  RELEASE_VERSION: version,
  DEPLOYMENT_ID: id,
  SOURCE_SHA: sha,
} = process.env;
if (
  !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version || "") ||
  !/^[a-f0-9-]{36}$/.test(id || "") ||
  !/^[a-f0-9]{40}$/.test(sha || "")
)
  throw Error("Invalid release metadata");
const files = readdirSync("signed").filter((f) => f.endsWith("-setup.exe"));
if (files.length !== 1) throw Error("Expected one installer");
const old = `signed/${files[0]}`,
  name = `CorelumNetwork_${version}_x64-setup.exe`,
  bytes = readFileSync(old),
  signature = readFileSync(old + ".sig", "utf8").trim();
renameSync(old, `signed/${name}`);
renameSync(old + ".sig", `signed/${name}.sig`);
writeFileSync(
  "signed/release.json",
  JSON.stringify(
    {
      version,
      deployment_id: id,
      source_sha: sha,
      key: `${id}/${name}`,
      signature,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
    null,
    2,
  ),
);
