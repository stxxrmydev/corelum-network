import { describe, it, expect } from "vitest";
import {
  passwordHash,
  equal,
  requireAdmin,
  tokenHash,
  randomToken,
} from "../service/src/auth";
describe("administrator security", () => {
  it("requires a bearer session before any privileged operation", async () => {
    await expect(
      requireAdmin(
        new Request("https://example.test/deployments"),
        {} as any,
        "secret",
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejects a forged or expired session", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ first: async () => null }) }),
    };
    await expect(
      requireAdmin(
        new Request("https://example.test/deployments", {
          headers: { Authorization: `Bearer ${"a".repeat(64)}` },
        }),
        db as any,
        "secret",
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("uses salted expensive hashes", async () => {
    const one = await passwordHash(
        "a long unique administrator password",
        "salt1",
      ),
      two = await passwordHash("a long unique administrator password", "salt2");
    expect(one).not.toBe(two);
    expect(
      equal(
        one,
        await passwordHash("a long unique administrator password", "salt1"),
      ),
    ).toBe(true);
  });
  it("does not accept short passwords", async () =>
    expect(passwordHash("password", "salt")).rejects.toThrow());
  it("stores a peppered session hash", async () => {
    const t = randomToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
    expect(await tokenHash(t, "one")).not.toBe(await tokenHash(t, "two"));
  });
  it("compares the full secret", () => {
    expect(equal("abc", "abc")).toBe(true);
    expect(equal("abc", "abcd")).toBe(false);
    expect(equal("abc", "abx")).toBe(false);
  });
});
