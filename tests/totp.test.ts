import { describe, it, expect } from "vitest";
import { createTotpSecret, totpAt, verifyTotp, totpUri } from "../service/src/totp";
describe("authenticator TOTP primitives", () => {
  it("matches RFC 6238 SHA-1 vectors truncated to six digits", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(await totpAt(secret, 59 / 30 | 0)).toBe("287082");
    expect(await totpAt(secret, 1111111109 / 30 | 0)).toBe("081804");
  });
  it("accepts current or adjacent 30-second windows only", async () => {
    const secret = createTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const code = await totpAt(secret, 100);
    expect(await verifyTotp(secret, code, 100 * 30000)).toBe(true);
    expect(await verifyTotp(secret, code, 101 * 30000)).toBe(true);
    expect(await verifyTotp(secret, code, 105 * 30000)).toBe(false);
    expect(await verifyTotp(secret, "12345", 100 * 30000)).toBe(false);
  });
  it("creates a standard authenticator enrollment URI", () => {
    expect(totpUri("A".repeat(32), "stormydev")).toContain("issuer=Corelum%20AI");
  });
});
