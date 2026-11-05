import { SqlObjectStore } from "../service/src/storage";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
let mf: Miniflare, db: any, bucket: any, token: string;
const origin = "https://control.test";
const request = (path: string, method = "GET", data?: any, auth?: string) =>
  mf.dispatchFetch(origin + path, {
    method,
    headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
beforeAll(async () => {
  const bundle = await build({
    entryPoints: ["service/src/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: "2026-10-01",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: ["DB"],
      bindings: {
        BOOTSTRAP_TOKEN: "b".repeat(64),
        SESSION_PEPPER: "p".repeat(64),
        PUBLIC_ORIGIN: origin,
        GITHUB_REPOSITORY: "owner/nimbus",
        SOURCE_BASE_SHA: "a".repeat(40),
      },
    }),
  );
  db = await mf.getD1Database("DB");
  bucket = new SqlObjectStore(db as any, "artifacts");
  await db.exec(readFileSync("service/migrations/0001_initial.sql", "utf8"));
  await db.exec(readFileSync("service/migrations/0002_object_storage.sql", "utf8"));
}, 30000);
afterAll(async () => {
  await mf?.dispose();
});
describe("real Worker and SQL integration", () => {
  it("denies anonymous admin endpoints", async () => {
    for (const path of [
      "/deployments",
      "/releases",
      "/source",
      "/policy",
      "/me",
    ])
      expect((await request(path)).status).toBe(401);
  });
  it("requires the bootstrap secret", async () =>
    expect(
      (await request("/auth/setup", "POST", { bootstrap: "wrong" })).status,
    ).toBe(403));
  it("creates the first admin only once", async () => {
    const input = {
      email: "admin@example.test",
      password: "a strong 20+ character password",
      bootstrap: "b".repeat(64),
    };
    expect((await request("/auth/setup", "POST", input)).status).toBe(200);
    expect((await request("/auth/setup", "POST", input)).status).toBe(409);
  });
  it("authenticates and enforces a real session lookup", async () => {
    const response = await request("/auth/login", "POST", {
      email: "admin@example.test",
      password: "a strong 20+ character password",
    });
    expect(response.status).toBe(200);
    token = ((await response.json()) as any).token;
    expect((await request("/me", "GET", undefined, token)).status).toBe(200);
  });
  it("returns 204 before a release is published", async () =>
    expect((await request("/updates/stable/windows/x86_64/1.0.0")).status).toBe(
      204,
    ));
  it("publishes a passing build atomically and selects the new version", async () => {
    const id = "12345678-1234-1234-1234-123456789012",
      source = "c".repeat(40),
      key = `${id}/Nimbus_1.0.1_x64-setup.exe`,
      hash = "f".repeat(64);
    const manifest = {
      version: "1.0.1",
      channel: "stable",
      baseCommit: "a".repeat(40),
      notes: "New insights page",
      urgent: true,
    };
    await db
      .prepare(
        "INSERT INTO deployments(id,version,channel,status,digest,manifest,summary,source_sha,created_at,actor) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        "1.0.1",
        "stable",
        "Ready",
        "d".repeat(64),
        JSON.stringify(manifest),
        "[]",
        source,
        new Date().toISOString(),
        "test",
      )
      .run();
    await bucket.put(
      `${id}/release.json`,
      JSON.stringify({
        deployment_id: id,
        version: "1.0.1",
        source_sha: source,
        key,
        sha256: hash,
        asset_id: 12345,
        signature: "s".repeat(100),
      }),
    );
    const publish = await request(
      `/deployments/${id}/publish`,
      "POST",
      undefined,
      token,
    );
    expect(publish.status).toBe(200);
    expect(((await publish.json()) as any).status).toBe("Released");
    const feed = await request("/updates/stable/windows/x86_64/1.0.0");
    expect(feed.status).toBe(200);
    expect(((await feed.json()) as any).version).toBe("1.0.1");
    expect((await request("/updates/stable/windows/x86_64/1.0.1")).status).toBe(
      204,
    );
    expect((await request("/updates/beta/windows/x86_64/1.0.0")).status).toBe(
      204,
    );
  });
  it("withdraws a release and stops new artifact downloads", async () => {
    const releases = (await (
      await request("/releases", "GET", undefined, token)
    ).json()) as any[];
    expect(
      (
        await request(
          `/releases/${releases[0].id}/withdraw`,
          "POST",
          undefined,
          token,
        )
      ).status,
    ).toBe(200);
    expect((await request("/updates/stable/windows/x86_64/1.0.0")).status).toBe(
      204,
    );
    const u = new URL(releases[0].url);
    expect((await request(u.pathname)).status).toBe(404);
  });
  it("revokes the session on logout", async () => {
    expect((await request("/logout", "POST", undefined, token)).status).toBe(
      200,
    );
    expect((await request("/me", "GET", undefined, token)).status).toBe(401);
  });
});
