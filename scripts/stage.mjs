import { readFileSync } from "node:fs";
const origin = process.env.CORELUM_SERVICE_URL;
if (!origin || new URL(origin).protocol !== "https:")
  throw Error("HTTPS service origin is required");
const m = JSON.parse(readFileSync("signed/release.json", "utf8"));
if (!/^[a-f0-9-]{36}\/Corelum(?:Network|AI)_[\w.-]+_x64-setup.exe$/.test(m.key))
  throw Error("Unsafe artifact key");
const identityURL = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
identityURL.searchParams.set("audience", origin);
const identityResponse = await fetch(identityURL, {
  headers: {
    Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
  },
});
if (!identityResponse.ok) throw Error("Could not obtain build identity");
const { value: token } = await identityResponse.json();
const claims = JSON.parse(
  Buffer.from(token.split(".")[1], "base64url").toString(),
);
console.log(
  "Build identity claims",
  JSON.stringify({
    sub: claims.sub,
    repository: claims.repository,
    ref: claims.ref,
    workflow_ref: claims.workflow_ref,
    run_id: claims.run_id,
    iss: claims.iss,
    aud: claims.aud,
  }),
);
async function send(path, bytes, headers) {
  const response = await fetch(origin + path, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body: bytes,
  });
  if (!response.ok) {
    let reason = "";
    try {
      reason = (await response.json()).error || "";
    } catch {}
    throw Error(`Artifact staging failed (${response.status}): ${reason}`);
  }
}
const releaseResponse = await fetch(
  `https://api.github.com/repos/${process.env.GH_REPO}/releases/tags/build-${m.deployment_id}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  },
);
if (!releaseResponse.ok) throw Error("GitHub release is missing");
const release = await releaseResponse.json();
const asset = release.assets.find((a) => a.name === m.key.split("/")[1]);
if (!asset) throw Error("Installer asset is missing");
m.asset_id = asset.id;
await send(`/ci/web/${m.deployment_id}`, readFileSync("signed/web.zip"), {
  "Content-Type": "application/zip",
});
await send(`/ci/manifest/${m.deployment_id}`, JSON.stringify(m), {
  "Content-Type": "application/json",
});
