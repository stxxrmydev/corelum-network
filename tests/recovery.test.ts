import { describe, expect, it } from "vitest";
import { createRecoveryCodes, normalizeRecoveryCode, recoveryCodeDigest } from "../service/src/recovery";
describe("one-time recovery code primitives", () => {
  it("generates distinct high-entropy codes", () => {
    const codes = createRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[0-9A-F]{10}-[0-9A-F]{10}$/);
  });
  it("normalizes input but rejects malformed codes", () => {
    const code = createRecoveryCodes(1)[0];
    expect(normalizeRecoveryCode(code.toLowerCase().replace("-", " "))).toBe(code.replace("-", ""));
    expect(normalizeRecoveryCode("1234")).toBeNull();
  });
  it("hashes codes with account-specific binding and secret pepper", async () => {
    const code = createRecoveryCodes(1)[0];
    const a = await recoveryCodeDigest(code,"account-a","pepper-1");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(await recoveryCodeDigest(code.toLowerCase(),"account-a","pepper-1"));
    expect(a).not.toBe(await recoveryCodeDigest(code,"account-b","pepper-1"));
    expect(a).not.toBe(await recoveryCodeDigest(code,"account-a","pepper-2"));
    expect(a).not.toContain(code.replace("-",""));
  });
});
