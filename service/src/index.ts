import semver from "semver";
import { validateArchive, sha256, type Manifest } from "../../shared/archive";
import {
  selectRelease,
  type Release,
  type Channel,
} from "../../shared/release";
import {
  HttpError,
  equal,
  randomToken,
  passwordHash,
  requireAdmin,
  tokenHash,
} from "./auth";
import { github, summarize, integrate, type GitEnv } from "./github";
import { requireBuild } from "./ci";
import { SqlObjectStore } from "./storage";
interface Env extends GitEnv {
  DB: D1Database;
  BOOTSTRAP_TOKEN: string;
  SESSION_PEPPER: string;
  PUBLIC_ORIGIN: string;
  SOURCE_BASE_SHA: string;
}
const json = (v: unknown, status = 200) =>
  Response.json(v, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const now = () => new Date().toISOString();
async function audit(env: Env, actor: string, action: string, target: string) {
  await env.DB.prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(), actor, action, target, now())
    .run();
}
async function body(req: Request) {
  const text = new TextDecoder().decode(await boundedBytes(req, 20000));
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
async function rateLimit(req: Request, env: Env) {
  const key = await tokenHash(
    req.headers.get("CF-Connecting-IP") || "local",
    env.SESSION_PEPPER,
  );
  const until = Date.now() + 900000;
  const row = await env.DB.prepare(
    "INSERT INTO throttle(key,count,until_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until_at<? THEN 1 ELSE count+1 END,until_at=CASE WHEN until_at<? THEN ? ELSE until_at END RETURNING count",
  )
    .bind(key, until, Date.now(), Date.now(), until)
    .first<{ count: number }>();
  if (!row || row.count > 10)
    throw new HttpError(
      429,
      "Too many sign-in attempts. Try again in 15 minutes.",
    );
}
async function baseFor(env: Env, channel: Channel) {
  const r = await env.DB.prepare(
    "SELECT source_sha FROM releases WHERE channel=? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(channel)
    .first<{ source_sha: string }>();
  return r?.source_sha || env.SOURCE_BASE_SHA;
}
async function loadDeployment(env: Env, id: string) {
  const d = await env.DB.prepare("SELECT * FROM deployments WHERE id=?")
    .bind(id)
    .first<any>();
  if (!d) throw new HttpError(404, "Deployment not found");
  return d;
}
export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url),
    path = url.pathname;
  if (path === "/health")
    return json({
      service: "Nimbus Control",
      schema: 1,
      configured: !!env.GITHUB_TOKEN,
    });
  if (!env.SESSION_PEPPER || env.SESSION_PEPPER.length < 32)
    throw new HttpError(
      503,
      "Administration service configuration is incomplete",
    );
  const ci = path.match(/^\/ci\/(manifest)\/([a-f0-9-]{36})$/);
  if (ci && req.method === "PUT") {
    const [, kind, id] = ci;
    await requireBuild(req, env, id);
    const d = await loadDeployment(env, id);
    if (["Released", "Failed", "Reviewing", "Integrating"].includes(d.status))
      throw new HttpError(409, "Deployment cannot accept build artifacts");
    const b = await body(req);
    if (
      b.deployment_id !== id ||
      b.version !== d.version ||
      b.source_sha !== d.source_sha ||
      b.key !== `${id}/Nimbus_${d.version}_x64-setup.exe` ||
      typeof b.signature !== "string" ||
      b.signature.length < 50 ||
      !/^[a-f0-9]{64}$/.test(b.sha256) ||
      !Number.isSafeInteger(b.asset_id) ||
      b.asset_id < 1
    )
      throw new HttpError(422, "Artifact metadata mismatch");
    const release = await github(env, `/releases/tags/build-${id}`);
    const asset = release.assets.find(
      (a: any) => a.id === b.asset_id && a.name === b.key.split("/")[1],
    );
    if (
      !asset ||
      asset.state !== "uploaded" ||
      (asset.digest && asset.digest !== `sha256:${b.sha256}`)
    )
      throw new HttpError(
        422,
        "GitHub release artifact does not match the signed build",
      );
    await new SqlObjectStore(env.DB, "artifacts").put(
      `${id}/release.json`,
      JSON.stringify(b),
    );
    return json({ ok: true });
  }
  if (path.startsWith("/updates/") && req.method === "GET") {
    const parts = path.split("/");
    if (
      parts.length !== 6 ||
      !["stable", "beta"].includes(parts[2]) ||
      parts[3] !== "windows" ||
      parts[4] !== "x86_64"
    )
      throw new HttpError(404, "Unsupported update target");
    const rows = await env.DB.prepare(
      "SELECT * FROM releases WHERE channel=? AND withdrawn=0",
    )
      .bind(parts[2])
      .all<Release>();
    const release = selectRelease(rows.results, parts[2] as Channel, parts[5]);
    return release
      ? json({
          version: release.version,
          url: release.url,
          signature: release.signature,
          notes: (release.urgent ? "[Urgent] " : "") + release.notes,
          pub_date: release.created_at,
        })
      : new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        });
  }
  if (path.startsWith("/artifacts/") && req.method === "GET") {
    const key = path.slice(11);
    if (!/^[a-f0-9-]{36}\/Nimbus_[a-zA-Z0-9.-]+_x64-setup.exe$/.test(key))
      throw new HttpError(404, "Artifact not found");
    const id = key.split("/")[0];
    const allowed = await env.DB.prepare(
      "SELECT id FROM releases WHERE deployment_id=? AND withdrawn=0",
    )
      .bind(id)
      .first();
    if (!allowed) throw new HttpError(404, "Release unavailable");
    const obj = await new SqlObjectStore(env.DB, "artifacts").get(
      `${id}/release.json`,
    );
    if (!obj) throw new HttpError(404, "Artifact unavailable");
    const m = await obj.json<any>();
    if (m.key !== key || !Number.isSafeInteger(m.asset_id))
      throw new HttpError(404, "Artifact unavailable");
    const range = req.headers.get("Range");
    const forward: Record<string, string> = range ? { Range: range } : {};
    let download = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/releases/assets/${m.asset_id}`,
      {
        headers: {
          ...forward,
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/octet-stream",
          "User-Agent": "Nimbus-Control",
        },
        redirect: "manual",
      },
    );
    if (download.status === 302) {
      const location = download.headers.get("Location");
      if (!location || new URL(location).protocol !== "https:")
        throw new HttpError(502, "Invalid artifact location");
      download = await fetch(location, {
        headers: forward,
        redirect: "follow",
      });
    }
    if (
      ![200, 206].includes(download.status) ||
      download.headers.get("Content-Type")?.includes("json")
    )
      throw new HttpError(502, "Release download is temporarily unavailable");
    const headers = new Headers({
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "ETag",
    ]) {
      const value = download.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(download.body, { status: download.status, headers });
  }
  if (path.startsWith("/auth/") && req.method === "POST") {
    await rateLimit(req, env);
    const b = await body(req);
    if (path === "/auth/setup") {
      if (
        !env.BOOTSTRAP_TOKEN ||
        env.BOOTSTRAP_TOKEN.length < 32 ||
        !equal(String(b.bootstrap || ""), env.BOOTSTRAP_TOKEN)
      )
        throw new HttpError(403, "Setup is not authorised");
      if (
        typeof b.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) ||
        typeof b.password !== "string"
      )
        throw new HttpError(400, "Valid email and password required");
      const salt = randomToken(),
        hash = await passwordHash(b.password, salt);
      const result = await env.DB.prepare(
        "INSERT INTO admins SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM admins)",
      )
        .bind(crypto.randomUUID(), b.email.toLowerCase(), salt, hash, now())
        .run();
      if (!result.meta.changes)
        throw new HttpError(409, "Administrator already configured");
      return json({ ok: true });
    }
    if (path === "/auth/login") {
      const admin = await env.DB.prepare("SELECT * FROM admins WHERE email=?")
        .bind(String(b.email).toLowerCase())
        .first<any>();
      let candidate = "";
      try {
        candidate = await passwordHash(
          String(b.password),
          admin?.salt || "invalid-account-salt",
        );
      } catch {}
      if (!admin || !equal(candidate, admin.password_hash))
        throw new HttpError(401, "Email or password was not accepted");
      const token = randomToken();
      await env.DB.prepare("INSERT INTO sessions VALUES(?,?,?)")
        .bind(
          await tokenHash(token, env.SESSION_PEPPER),
          admin.id,
          Date.now() + 8 * 3600000,
        )
        .run();
      return json({ token });
    }
  }
  const actor = await requireAdmin(req, env.DB, env.SESSION_PEPPER);
  if (path === "/me") return json({ role: "admin", id: actor });
  if (path === "/logout" && req.method === "POST") {
    await env.DB.prepare("DELETE FROM sessions WHERE hash=?")
      .bind(
        await tokenHash(
          req.headers.get("Authorization")!.slice(7),
          env.SESSION_PEPPER,
        ),
      )
      .run();
    return json({ ok: true });
  }
  if (path === "/policy") {
    if (req.method === "PUT") {
      const b = await body(req);
      await env.DB.prepare("UPDATE policy SET auto_publish=? WHERE id=1")
        .bind(b.autoPublish === true ? 1 : 0)
        .run();
      await audit(env, actor, "policy", "auto_publish");
    }
    return json(
      await env.DB.prepare(
        "SELECT auto_publish FROM policy WHERE id=1",
      ).first(),
    );
  }
  if (path === "/releases" && req.method === "GET")
    return json(
      (
        await env.DB.prepare(
          "SELECT * FROM releases ORDER BY created_at DESC LIMIT 100",
        ).all()
      ).results,
    );
  if (path === "/deployments" && req.method === "GET")
    return json(
      (
        await env.DB.prepare(
          "SELECT * FROM deployments ORDER BY created_at DESC LIMIT 50",
        ).all()
      ).results,
    );
  if (path === "/source" && req.method === "GET") {
    const channel =
      url.searchParams.get("channel") === "beta" ? "beta" : "stable";
    return json({ baseCommit: await baseFor(env, channel), channel });
  }
  if (path === "/bootstrap-release" && req.method === "POST") {
    if (await env.DB.prepare("SELECT id FROM deployments LIMIT 1").first())
      throw new HttpError(409, "Initial build has already been created");
    const id = crypto.randomUUID(),
      source = env.SOURCE_BASE_SHA;
    if (!/^[a-f0-9]{40}$/.test(source))
      throw new HttpError(503, "Initial source revision is not configured");
    const manifest = {
      schema: 1,
      version: "1.0.0",
      baseVersion: "0.0.0",
      baseCommit: source,
      channel: "stable",
      minShellVersion: "1.0.0",
      notes: "Nimbus Foundation. Your workspace, continuously evolving.",
      remove: [],
      urgent: false,
    };
    await env.DB.prepare(
      "INSERT INTO deployments(id,version,channel,status,digest,manifest,summary,source_sha,created_at,actor) VALUES(?,?,?,'Building',?,?,?,?,?,?)",
    )
      .bind(
        id,
        "1.0.0",
        "stable",
        "bootstrap",
        JSON.stringify(manifest),
        "[]",
        source,
        now(),
        actor,
      )
      .run();
    try {
      await github(env, "/actions/workflows/release.yml/dispatches", "POST", {
        ref: env.GITHUB_BRANCH,
        inputs: {
          deployment_id: id,
          source_sha: source,
          version: "1.0.0",
          channel: "stable",
        },
      });
    } catch (e) {
      await env.DB.prepare(
        "UPDATE deployments SET status='Failed',error='Initial build dispatch failed' WHERE id=?",
      )
        .bind(id)
        .run();
      throw e;
    }
    await audit(env, actor, "bootstrap-build", id);
    return json({ id });
  }
  if (path === "/deployments" && req.method === "POST") {
    if (Number(req.headers.get("Content-Length")) > 4194304)
      throw new HttpError(413, "ZIP exceeds 4 MiB");
    const reader = req.body?.getReader();
    if (!reader) throw new HttpError(400, "Empty upload");
    let total = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 4194304) {
        await reader.cancel();
        throw new HttpError(413, "ZIP exceeds 4 MiB");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) {
      bytes.set(c, p);
      p += c.length;
    }
    const archive = await validateArchive(bytes),
      m = archive.manifest;
    if (m.baseCommit !== (await baseFor(env, m.channel)))
      throw new HttpError(409, "Archive is based on an old source revision");
    const published = await env.DB.prepare(
      "SELECT version FROM releases WHERE channel=? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(m.channel)
      .first<{ version: string }>();
    if (published && m.baseVersion !== published.version)
      throw new HttpError(
        409,
        "Archive base version does not match the channel",
      );
    const summary = await summarize(env, archive),
      id = crypto.randomUUID();
    await new SqlObjectStore(env.DB, "archives").put(id, bytes);
    await env.DB.prepare(
      "INSERT INTO deployments(id,version,channel,status,digest,manifest,summary,created_at,actor) VALUES(?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        m.version,
        m.channel,
        "Reviewing",
        archive.digest,
        JSON.stringify(m),
        JSON.stringify(summary),
        now(),
        actor,
      )
      .run();
    await audit(env, actor, "upload", id);
    return json(
      { id, status: "Reviewing", manifest: m, summary, digest: archive.digest },
      201,
    );
  }
  const match = path.match(
    /^\/deployments\/([a-f0-9-]{36})(?:\/(approve|refresh|publish))?$/,
  );
  if (match) {
    const [, id, action] = match;
    let d = await loadDeployment(env, id);
    if (!action && req.method === "GET") return json(d);
    if (action === "approve" && req.method === "POST") {
      if (d.status !== "Reviewing")
        throw new HttpError(409, "Deployment cannot be approved in this state");
      const m: Manifest = JSON.parse(d.manifest);
      if (m.baseCommit !== (await baseFor(env, m.channel)))
        throw new HttpError(409, "Channel advanced. Upload a rebased archive.");
      const lock = await env.DB.prepare(
        "UPDATE deployments SET status='Integrating' WHERE id=? AND status='Reviewing'",
      )
        .bind(id)
        .run();
      if (!lock.meta.changes) throw new HttpError(409, "Already approved");
      try {
        const obj = await new SqlObjectStore(env.DB, "archives").get(id);
        if (!obj) throw new Error("Archive is missing");
        const archive = await validateArchive(
          new Uint8Array(await obj.arrayBuffer()),
        );
        if (archive.digest !== d.digest) throw new Error("Archive changed");
        const sha = await integrate(env, id, archive);
        await env.DB.prepare(
          "UPDATE deployments SET status='Building',source_sha=? WHERE id=?",
        )
          .bind(sha, id)
          .run();
        await github(env, "/actions/workflows/release.yml/dispatches", "POST", {
          ref: env.GITHUB_BRANCH,
          inputs: {
            deployment_id: id,
            source_sha: sha,
            version: m.version,
            channel: m.channel,
          },
        });
        await audit(env, actor, "approve", id);
      } catch (e) {
        await env.DB.prepare(
          "UPDATE deployments SET status='Failed',error='Integration or build dispatch failed. Check repository configuration.' WHERE id=?",
        )
          .bind(id)
          .run();
        throw e;
      }
      return json(await loadDeployment(env, id));
    }
    if (action === "refresh" && req.method === "POST")
      return refresh(env, id, actor);
    if (action === "publish" && req.method === "POST")
      return publish(env, id, actor);
  }
  const withdraw = path.match(/^\/releases\/([a-f0-9-]{36})\/withdraw$/);
  if (withdraw && req.method === "POST") {
    await env.DB.prepare("UPDATE releases SET withdrawn=1 WHERE id=?")
      .bind(withdraw[1])
      .run();
    await audit(env, actor, "withdraw", withdraw[1]);
    return json({ ok: true });
  }
  throw new HttpError(404, "Endpoint not found");
}
async function boundedBytes(req: Request, limit: number) {
  if (Number(req.headers.get("Content-Length")) > limit)
    throw new HttpError(413, "Request too large");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Empty request");
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    n += r.value.length;
    if (n > limit) {
      await reader.cancel();
      throw new HttpError(413, "Request too large");
    }
    chunks.push(r.value);
  }
  const bytes = new Uint8Array(n);
  let p = 0;
  for (const c of chunks) {
    bytes.set(c, p);
    p += c.length;
  }
  return bytes;
}
async function refresh(env: Env, id: string, actor: string) {
  const d = await loadDeployment(env, id);
  if (["Released", "Failed", "Reviewing"].includes(d.status)) return json(d);
  const runs = await github(
    env,
    "/actions/workflows/release.yml/runs?event=workflow_dispatch&per_page=100",
  );
  const run = runs.workflow_runs.find(
    (r: any) => r.display_title === `Nimbus ${id}`,
  );
  if (run) {
    let status = "Building";
    let error = null;
    if (run.status === "completed") {
      if (run.conclusion === "success") status = "Ready";
      else {
        status = "Failed";
        error = "Build checks failed. Review the GitHub Actions run.";
      }
    } else {
      const jobs = await github(env, `/actions/runs/${run.id}/jobs`);
      const active = jobs.jobs.find((j: any) => j.status === "in_progress");
      if (active) {
        if (active.name === "Validate and test") status = "Testing";
        if (active.name === "Sign trusted artifact") status = "Signing";
        if (active.name === "Stage release") status = "Publishing";
      }
    }
    await env.DB.prepare(
      "UPDATE deployments SET status=?,run_id=?,error=? WHERE id=? AND status!='Released'",
    )
      .bind(status, String(run.id), error, id)
      .run();
    const policy = await env.DB.prepare(
      "SELECT auto_publish FROM policy WHERE id=1",
    ).first<any>();
    if (status === "Ready" && policy?.auto_publish)
      return publish(env, id, actor);
  }
  return json(await loadDeployment(env, id));
}
async function publish(env: Env, id: string, actor: string) {
  const d = await loadDeployment(env, id);
  if (d.status === "Released") return json(d);
  if (d.status !== "Ready")
    throw new HttpError(409, "Build is not ready to publish");
  const m: Manifest = JSON.parse(d.manifest);
  if (m.baseCommit !== (await baseFor(env, m.channel)))
    throw new HttpError(409, "Channel advanced. A new archive is required.");
  const key = `${id}/release.json`,
    object = await new SqlObjectStore(env.DB, "artifacts").get(key);
  if (!object) throw new HttpError(409, "Signed build manifest is missing");
  const artifact = await object.json<any>();
  const expected = `${id}/Nimbus_${d.version}_x64-setup.exe`;
  if (
    artifact.version !== d.version ||
    artifact.deployment_id !== id ||
    artifact.source_sha !== d.source_sha ||
    artifact.key !== expected ||
    !/^[a-f0-9]{64}$/.test(artifact.sha256) ||
    typeof artifact.signature !== "string" ||
    artifact.signature.length < 50
  )
    throw new HttpError(422, "Signed build metadata does not match approval");
  if (!Number.isSafeInteger(artifact.asset_id) || artifact.asset_id < 1)
    throw new HttpError(422, "Signed installer reference is missing");
  const releaseId = crypto.randomUUID();
  const results = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO releases SELECT ?,?,?,?,?,?,?,?,?,0,?,? WHERE EXISTS(SELECT 1 FROM deployments WHERE id=? AND status='Ready') AND COALESCE((SELECT source_sha FROM releases WHERE channel=? ORDER BY rowid DESC LIMIT 1),?)=?",
    ).bind(
      releaseId,
      id,
      d.version,
      d.channel,
      m.notes,
      `${env.PUBLIC_ORIGIN}/artifacts/${expected}`,
      artifact.signature,
      artifact.sha256,
      m.urgent ? 1 : 0,
      now(),
      d.source_sha,
      id,
      d.channel,
      env.SOURCE_BASE_SHA,
      m.baseCommit,
    ),
    env.DB.prepare(
      "UPDATE deployments SET status='Released' WHERE id=? AND status='Ready' AND EXISTS(SELECT 1 FROM releases WHERE deployment_id=?)",
    ).bind(id, id),
  ]);
  if (!results[0].meta.changes) throw new HttpError(409, "Already publishing");
  await audit(env, actor, "publish", id);
  return json(await loadDeployment(env, id));
}
export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const pending = await env.DB.prepare(
      "SELECT id FROM deployments WHERE status IN ('Building','Testing','Signing','Publishing','Ready') ORDER BY created_at LIMIT 5",
    ).all<{ id: string }>();
    ctx.waitUntil(
      (async () => {
        for (const d of pending.results) {
          try {
            await refresh(env, d.id, "pipeline");
          } catch {
            await audit(env, "pipeline", "refresh-failed", d.id);
          }
        }
        await env.DB.batch([
          env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(
            Date.now(),
          ),
          env.DB.prepare("DELETE FROM throttle WHERE until_at<?").bind(
            Date.now(),
          ),
        ]);
      })(),
    );
  },
  async fetch(req: Request, env: Env) {
    try {
      return await handle(req, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (
        e instanceof Error &&
        /ZIP|archive|manifest|Protected|Unsafe|version|compression|file|path|Decompression/i.test(
          e.message,
        )
      )
        return json({ error: e.message }, 422);
      return json(
        {
          error:
            "The operation could not be completed. Please try again or contact the administrator.",
        },
        500,
      );
    }
  },
};
