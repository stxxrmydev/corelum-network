import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";
const files = {};
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) walk(path);
    else
      files[relative("dist", path).replaceAll("\\", "/")] = readFileSync(path);
  }
}
walk("dist");
writeFileSync("web.zip", zipSync(files, { level: 6 }));
