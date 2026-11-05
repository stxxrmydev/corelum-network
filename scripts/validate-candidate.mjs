import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const {
  DEPLOYMENT_ID: id,
  SOURCE_SHA: sha,
  RELEASE_VERSION: version,
  RELEASE_CHANNEL: channel,
} = process.env;
if (
  !/^[a-f0-9-]{36}$/.test(id || "") ||
  !/^[a-f0-9]{40}$/.test(sha || "") ||
  !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version || "") ||
  !["stable", "beta"].includes(channel)
)
  throw Error("Invalid release inputs");
const root = resolve(process.argv[2]);
const git = (...args) =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
if (git("rev-parse", "HEAD") !== sha) throw Error("Candidate commit mismatch");
const trustedHead = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (sha === trustedHead) {
  if (
    JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version !==
      version ||
    version !== "1.0.0"
  )
    throw Error("Invalid initial build");
  console.log("Initial build uses the exact trusted source revision.");
  process.exit(0);
}
const files = git("diff", "--name-only", `${sha}^`, sha).split("\n");
const generated = new Set([
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
]);
for (const path of files) {
  if (generated.has(path)) continue;
  if (
    !/^(src\/(features|ui)\/[a-zA-Z0-9_/-]+\.(tsx?|css|json)|public\/[a-zA-Z0-9_/-]+\.(png|jpg|webp|svg|ico|txt|json))$/.test(
      path,
    )
  )
    throw Error(`Protected file changed: ${path}`);
}
for (const path of ["package.json", "src-tauri/tauri.conf.json"]) {
  const before = JSON.parse(git("show", `${sha}^:${path}`)),
    after = JSON.parse(readFileSync(resolve(root, path), "utf8"));
  if (after.version !== version) throw Error("Version mismatch");
  delete before.version;
  delete after.version;
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error(`Protected configuration changed: ${path}`);
}
const cargoBefore = git("show", `${sha}^:src-tauri/Cargo.toml`),
  cargoAfter = readFileSync(
    resolve(root, "src-tauri/Cargo.toml"),
    "utf8",
  ).trim();
if (
  cargoBefore.replace(/^version = "[^"]+"/m, `version = "${version}"`) !==
  cargoAfter
)
  throw Error("Protected Cargo configuration changed");
console.log(
  "Candidate paths, generated versions and immutable build configuration verified.",
);
