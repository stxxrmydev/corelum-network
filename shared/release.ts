import semver from "semver";
export type Channel = "stable" | "beta";
export interface Release {
  id: string;
  version: string;
  channel: Channel;
  notes: string;
  url: string;
  signature: string;
  sha256: string;
  urgent: boolean;
  created_at: string;
  withdrawn: number;
  deployment_id: string;
}
export function validVersion(version: string, channel: Channel) {
  if (
    !semver.valid(version) ||
    version.startsWith("v") ||
    (channel === "stable" && semver.prerelease(version))
  )
    throw new Error(
      "A valid version matching the release channel is required.",
    );
  return version;
}
export function selectRelease(
  releases: Release[],
  channel: Channel,
  current: string,
) {
  if (!semver.valid(current)) throw new Error("Invalid installed version");
  return releases
    .filter(
      (r) =>
        r.channel === channel &&
        !r.withdrawn &&
        semver.valid(r.version) &&
        semver.gt(r.version, current),
    )
    .sort((a, b) => semver.rcompare(a.version, b.version))[0];
}
