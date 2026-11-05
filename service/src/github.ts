import type { ValidatedArchive } from "../../shared/archive";
import { HttpError } from "./auth";
export interface GitEnv {
  GITHUB_TOKEN: string;
  GITHUB_REPOSITORY: string;
  GITHUB_BRANCH: string;
}
export async function github(
  env: GitEnv,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY))
    throw new HttpError(503, "Repository has not been configured");
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Corelum-Control",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new HttpError(
      502,
      `GitHub API ${method} ${path.split("?")[0].replace(/\/[a-f0-9-]{36}/gi, "/:id")} failed (HTTP ${response.status})`,
    );
  return response.status === 204 ? null : response.json();
}
export async function fileAt(env: GitEnv, path: string, ref: string) {
  return github(env, `/contents/${path}?ref=${ref}`);
}
export async function summarize(env: GitEnv, archive: ValidatedArchive) {
  const tree = await github(
    env,
    `/git/trees/${archive.manifest.baseCommit}?recursive=1`,
  );
  if (tree.truncated) throw new HttpError(422, "Source tree is too large");
  const existing = new Map<string, any>(tree.tree.map((f: any) => [f.path, f]));
  const summary = [];
  for (const [path, data] of archive.files) {
    const prior = existing.get(path);
    if (prior && (prior.mode !== "100644" || prior.type !== "blob"))
      throw new HttpError(422, "Cannot replace special source entries");
    for (const p of existing.keys())
      if (p.toLowerCase() === path.toLowerCase() && p !== path)
        throw new HttpError(422, "Source path has different casing");
    const segments = path.split("/");
    for (let i = 1; i < segments.length; i++) {
      const parent = existing.get(segments.slice(0, i).join("/"));
      if (parent && parent.type !== "tree")
        throw new HttpError(422, "Unsafe source parent");
    }
    summary.push({
      path,
      kind: prior ? "modified" : "added",
      bytes: data.length,
    });
  }
  for (const path of archive.manifest.remove) {
    if (!existing.has(path))
      throw new HttpError(422, `Cannot remove missing file: ${path}`);
    summary.push({ path, kind: "removed", bytes: 0 });
  }
  return summary;
}
function base64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export async function integrate(
  env: GitEnv,
  id: string,
  archive: ValidatedArchive,
) {
  const tree: any[] = [];
  for (const [path, data] of archive.files) {
    const blob = await github(env, "/git/blobs", "POST", {
      content: base64(data),
      encoding: "base64",
    });
    tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }
  for (const path of archive.manifest.remove)
    tree.push({ path, mode: "100644", type: "blob", sha: null });
  for (const path of ["package.json", "src-tauri/tauri.conf.json"]) {
    const f = await fileAt(env, path, archive.manifest.baseCommit);
    const json = JSON.parse(atob(f.content.replace(/\s/g, "")));
    json.version = archive.manifest.version;
    tree.push({
      path,
      mode: "100644",
      type: "blob",
      content: JSON.stringify(json, null, 2) + "\n",
    });
  }
  const cargo = await fileAt(
    env,
    "src-tauri/Cargo.toml",
    archive.manifest.baseCommit,
  );
  tree.push({
    path: "src-tauri/Cargo.toml",
    mode: "100644",
    type: "blob",
    content: atob(cargo.content.replace(/\s/g, "")).replace(
      /^version = "[^"]+"/m,
      `version = "${archive.manifest.version}"`,
    ),
  });
  const base = await github(env, `/git/commits/${archive.manifest.baseCommit}`);
  const next = await github(env, "/git/trees", "POST", {
    base_tree: base.tree.sha,
    tree,
  });
  const commit = await github(env, "/git/commits", "POST", {
    message: `Release ${archive.manifest.version} (approved ${id})`,
    tree: next.sha,
    parents: [archive.manifest.baseCommit],
  });
  await github(env, "/git/refs", "POST", {
    ref: `refs/heads/deploy/${id}`,
    sha: commit.sha,
  });
  return commit.sha as string;
}
