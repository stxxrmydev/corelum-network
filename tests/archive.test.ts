import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { validateArchive, safePath, permittedPath } from "../shared/archive";
export const manifest = {
  schema: 1,
  version: "1.0.1",
  baseVersion: "1.0.0",
  baseCommit: "a".repeat(40),
  channel: "stable",
  minShellVersion: "1.0.0",
  notes: "A new page",
  remove: [],
  urgent: false,
};
const make = (files: Record<string, Uint8Array> = {}, m: any = manifest) =>
  zipSync(
    {
      "update.json": strToU8(JSON.stringify(m)),
      "src/features/notes/index.tsx": strToU8("export default {}"),
      ...files,
    },
    { level: 0 },
  );
describe("untrusted archives", () => {
  it("accepts a bounded, intact feature archive", async () => {
    const r = await validateArchive(make());
    expect(r.manifest.version).toBe("1.0.1");
    expect(r.files.size).toBe(1);
    expect(r.digest).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each([
    "../escape",
    "/absolute",
    "C:/evil",
    "src/../evil",
    "src//evil",
    "src/a./evil",
    "src/CON.txt",
    "src/a\\evil",
    "src/aux.ts",
  ])("rejects unsafe path %s", (p) => expect(() => safePath(p)).toThrow());
  it.each([
    ".github/workflows/release.yml",
    "src/main.tsx",
    "src/core/bridge.ts",
    "src-tauri/src/lib.rs",
    "package.json",
    "public/a.exe",
    "service/src/auth.ts",
  ])("protects %s", async (p) =>
    expect(validateArchive(make({ [p]: strToU8("bad") }))).rejects.toThrow(),
  );
  it("rejects case aliases", async () =>
    expect(
      validateArchive(
        make({ "src/features/notes/INDEX.tsx": strToU8("alias") }),
      ),
    ).rejects.toThrow(/colliding/));
  it("rejects an oversized archive before inflation", async () =>
    expect(validateArchive(new Uint8Array(4194305))).rejects.toThrow(/4 MiB/));
  it("rejects a high compression bomb", async () => {
    const zip = zipSync(
      {
        "update.json": strToU8(JSON.stringify(manifest)),
        "public/bomb.txt": new Uint8Array(1024 * 1024),
      },
      { level: 9 },
    );
    await expect(validateArchive(zip)).rejects.toThrow(/compression/);
  });
  it("checks CRC rather than trusting ZIP metadata", async () => {
    const zip = make();
    zip[30 + "update.json".length + 5] ^= 1;
    await expect(validateArchive(zip)).rejects.toThrow(/integrity/);
  });
  it("rejects truncated ZIPs", async () =>
    expect(validateArchive(make().slice(0, -5))).rejects.toThrow());
  it("rejects local/central path mismatch", async () => {
    const zip = make();
    zip[30] = "x".charCodeAt(0);
    await expect(validateArchive(zip)).rejects.toThrow(/mismatch/);
  });
  it("rejects symlinks", async () => {
    const zip = make();
    const v = new DataView(zip.buffer);
    for (let p = 0; p < zip.length - 46; p++)
      if (v.getUint32(p, true) === 0x02014b50) {
        v.setUint32(p + 38, 0xa1ff0000, true);
        break;
      }
    await expect(validateArchive(zip)).rejects.toThrow(/Links/);
  });
  it("rejects a downgrade archive", async () =>
    expect(
      validateArchive(make({}, { ...manifest, version: "0.9.0" })),
    ).rejects.toThrow());
  it("rejects future core compatibility", async () =>
    expect(
      validateArchive(make({}, { ...manifest, minShellVersion: "2.0.0" })),
    ).rejects.toThrow());
  it("rejects unreviewed core removals", async () =>
    expect(
      validateArchive(
        make({}, { ...manifest, remove: ["src/core/bridge.ts"] }),
      ),
    ).rejects.toThrow());
  it("rejects conflicting add/remove", async () =>
    expect(
      validateArchive(
        make({}, { ...manifest, remove: ["src/features/notes/index.tsx"] }),
      ),
    ).rejects.toThrow());
  it("requires stable release versions on stable", async () =>
    expect(
      validateArchive(make({}, { ...manifest, version: "1.0.1-beta.1" })),
    ).rejects.toThrow());
  it("accepts compressed files with CRC verification", async () => {
    const zip = zipSync(
      {
        "update.json": strToU8(JSON.stringify(manifest)),
        "public/text.txt": strToU8(
          "A modestly compressed document. ".repeat(12),
        ),
      },
      { level: 6 },
    );
    expect((await validateArchive(zip)).files.size).toBe(1);
  });
});
