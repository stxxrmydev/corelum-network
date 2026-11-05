import { Inflate, strFromU8 } from "fflate";
import semver from "semver";
import { validVersion, type Channel } from "./release";
export interface Manifest {
  schema: 1;
  version: string;
  baseVersion: string;
  baseCommit: string;
  channel: Channel;
  minShellVersion: string;
  notes: string;
  remove: string[];
  urgent: boolean;
}
export interface ValidatedArchive {
  manifest: Manifest;
  files: Map<string, Uint8Array>;
  digest: string;
}
const MAX_ZIP = 4 * 1024 * 1024,
  MAX_FILE = 2 * 1024 * 1024,
  MAX_TOTAL = 8 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
export function safePath(path: string) {
  if (
    path.length > 200 ||
    !/^[a-zA-Z0-9_./-]+$/.test(path) ||
    path.includes("\\") ||
    path.startsWith("/") ||
    path
      .split("/")
      .some(
        (p) =>
          !p ||
          p === "." ||
          p === ".." ||
          p.endsWith(".") ||
          /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p),
      )
  )
    throw new Error("Unsafe archive path");
  return path;
}
export function permittedPath(path: string) {
  safePath(path);
  if (
    !/^(src\/(features|ui)\/[a-zA-Z0-9_/-]+\.(tsx?|css|json)|public\/[a-zA-Z0-9_/-]+\.(png|jpg|webp|svg|ico|txt|json))$/.test(
      path,
    )
  )
    throw new Error(`Protected or unsupported path: ${path}`);
  return path;
}
export async function sha256(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
export async function validateArchive(
  bytes: Uint8Array,
): Promise<ValidatedArchive> {
  if (bytes.length < 22 || bytes.length > MAX_ZIP)
    throw new Error("ZIP must be no larger than 4 MiB");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Invalid ZIP directory");
  const count = view.getUint16(end + 10, true),
    start = view.getUint32(end + 16, true),
    length = view.getUint32(end + 12, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    view.getUint16(end + 8, true) !== count ||
    count < 2 ||
    count > 100 ||
    start + length !== end
  )
    throw new Error("Unsupported ZIP structure");
  const files = new Map<string, Uint8Array>(),
    names = new Set<string>();
  let cursor = start,
    total = 0;
  const ranges: number[][] = [];
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("Invalid ZIP entry");
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      crc = view.getUint32(cursor + 16, true),
      packed = view.getUint32(cursor + 20, true),
      size = view.getUint32(cursor + 24, true),
      nl = view.getUint16(cursor + 28, true),
      el = view.getUint16(cursor + 30, true),
      cl = view.getUint16(cursor + 32, true),
      mode = view.getUint32(cursor + 38, true) >>> 16,
      offset = view.getUint32(cursor + 42, true);
    if (cursor + 46 + nl + el + cl > end)
      throw new Error("Truncated ZIP directory");
    const path = safePath(
      decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nl)),
    );
    if (names.has(path.toLowerCase()))
      throw new Error("Duplicate or case-colliding file");
    names.add(path.toLowerCase());
    if ((mode & 0xf000) !== 0 && (mode & 0xf000) !== 0x8000)
      throw new Error("Links and special files are forbidden");
    if (
      flags & ~0x0808 ||
      ![0, 8].includes(method) ||
      size > MAX_FILE ||
      size > Math.max(packed, 1) * 100 ||
      (total += size) > MAX_TOTAL
    )
      throw new Error("Unsafe compression or archive size");
    if (offset + 30 > start || view.getUint32(offset, true) !== 0x04034b50)
      throw new Error("Invalid local ZIP header");
    const lnl = view.getUint16(offset + 26, true),
      lel = view.getUint16(offset + 28, true),
      dataStart = offset + 30 + lnl + lel,
      dataEnd = dataStart + packed;
    if (
      dataEnd > start ||
      decoder.decode(bytes.subarray(offset + 30, offset + 30 + lnl)) !== path ||
      view.getUint16(offset + 6, true) !== flags ||
      view.getUint16(offset + 8, true) !== method
    )
      throw new Error("ZIP header mismatch");
    if (
      !(flags & 8) &&
      (view.getUint32(offset + 14, true) !== crc ||
        view.getUint32(offset + 18, true) !== packed ||
        view.getUint32(offset + 22, true) !== size)
    )
      throw new Error("ZIP size mismatch");
    if (ranges.some(([a, b]) => offset < b && dataEnd > a))
      throw new Error("Overlapping ZIP entries");
    ranges.push([offset, dataEnd]);
    const input = bytes.subarray(dataStart, dataEnd);
    let data: Uint8Array;
    if (method === 0) {
      data = input.slice();
    } else {
      const chunks: Uint8Array[] = [];
      let got = 0;
      const inflate = new Inflate((chunk) => {
        got += chunk.length;
        if (got > size || got > MAX_FILE)
          throw new Error("Decompression limit exceeded");
        chunks.push(chunk);
      });
      for (let p = 0; p < input.length; p += 1024)
        inflate.push(
          input.subarray(p, Math.min(p + 1024, input.length)),
          p + 1024 >= input.length,
        );
      data = new Uint8Array(got);
      let pos = 0;
      for (const chunk of chunks) {
        data.set(chunk, pos);
        pos += chunk.length;
      }
    }
    if (data.length !== size || crc32(data) !== crc)
      throw new Error("ZIP integrity check failed");
    if (path !== "update.json") permittedPath(path);
    files.set(path, data);
    cursor += 46 + nl + el + cl;
  }
  if (cursor !== end || !files.has("update.json"))
    throw new Error("Missing update.json");
  let m: Manifest;
  try {
    m = JSON.parse(strFromU8(files.get("update.json")!));
  } catch {
    throw new Error("Invalid update manifest");
  }
  if (
    m.schema !== 1 ||
    !["stable", "beta"].includes(m.channel) ||
    !semver.valid(m.baseVersion) ||
    !semver.valid(m.minShellVersion) ||
    !semver.valid(m.version) ||
    !semver.gt(m.version, m.baseVersion) ||
    !semver.lte(m.minShellVersion, m.baseVersion) ||
    !/^[a-f0-9]{40}$/.test(m.baseCommit) ||
    typeof m.notes !== "string" ||
    m.notes.length > 8000 ||
    typeof m.urgent !== "boolean" ||
    !Array.isArray(m.remove) ||
    m.remove.length > 50
  )
    throw new Error("Invalid or incompatible manifest");
  validVersion(m.version, m.channel);
  const deleted = new Set<string>();
  for (const path of m.remove) {
    permittedPath(path);
    if (files.has(path) || deleted.has(path.toLowerCase()))
      throw new Error("Conflicting removal");
    deleted.add(path.toLowerCase());
  }
  files.delete("update.json");
  return { manifest: m, files, digest: await sha256(bytes) };
}
