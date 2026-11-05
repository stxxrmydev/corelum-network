import { createRemoteJWKSet, jwtVerify } from "jose";
import { HttpError } from "./auth";
import { github, type GitEnv } from "./github";
const jwks = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);
export async function requireBuild(
  request: Request,
  env: GitEnv & {
    PUBLIC_ORIGIN: string;
    GITHUB_REPOSITORY_ID: string;
    GITHUB_OWNER_ID: string;
  },
  id: string,
) {
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Build identity required");
  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: env.PUBLIC_ORIGIN,
      algorithms: ["RS256"],
    }));
  } catch {
    throw new HttpError(403, "Build identity was not accepted");
  }
  const [owner, repository] = env.GITHUB_REPOSITORY.split("/");
  if (
    payload.sub !==
      `repo:${owner}@${env.GITHUB_OWNER_ID}/${repository}@${env.GITHUB_REPOSITORY_ID}:ref:refs/heads/${env.GITHUB_BRANCH}` ||
    String(payload.repository_id) !== env.GITHUB_REPOSITORY_ID ||
    String(payload.repository_owner_id) !== env.GITHUB_OWNER_ID ||
    payload.repository !== env.GITHUB_REPOSITORY ||
    payload.ref !== `refs/heads/${env.GITHUB_BRANCH}` ||
    payload.workflow_ref !==
      `${env.GITHUB_REPOSITORY}/.github/workflows/release.yml@refs/heads/${env.GITHUB_BRANCH}` ||
    !/^\d+$/.test(String(payload.run_id))
  )
    throw new HttpError(403, "Build workflow was not accepted");
  const run = await github(env, `/actions/runs/${payload.run_id}`);
  if (
    run.display_title !== `Corelum ${id}` ||
    run.event !== "workflow_dispatch" ||
    run.path !== ".github/workflows/release.yml"
  )
    throw new HttpError(403, "Build does not match deployment");
  return String(payload.run_id);
}
