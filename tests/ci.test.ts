import { describe, it, expect } from "vitest";
import { requireBuild } from "../service/src/ci";
import { generateKeyPair, SignJWT, jwtVerify } from "jose";
describe("CI identity boundary", () => {
  it("rejects missing identity before repository access", async () =>
    expect(
      requireBuild(
        new Request("https://control.test/ci"),
        { PUBLIC_ORIGIN: "https://control.test" } as any,
        "id",
      ),
    ).rejects.toMatchObject({ status: 401 }));
  it("rejects malformed identities", async () =>
    expect(
      requireBuild(
        new Request("https://control.test/ci", {
          headers: { Authorization: "Bearer forged" },
        }),
        { PUBLIC_ORIGIN: "https://control.test" } as any,
        "id",
      ),
    ).rejects.toMatchObject({ status: 403 }));
  it("verifies audience, expiration and cryptographic signatures using the same JOSE verifier", async () => {
    const keys = await generateKeyPair("RS256");
    const token = await new SignJWT({ repository: "owner/repo" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://token.actions.githubusercontent.com")
      .setAudience("https://control.test")
      .setExpirationTime("2m")
      .sign(keys.privateKey);
    expect(
      (
        await jwtVerify(token, keys.publicKey, {
          issuer: "https://token.actions.githubusercontent.com",
          audience: "https://control.test",
        })
      ).payload.repository,
    ).toBe("owner/repo");
    await expect(
      jwtVerify(token, keys.publicKey, { audience: "https://wrong.test" }),
    ).rejects.toThrow();
    const other = await generateKeyPair("RS256");
    await expect(jwtVerify(token, other.publicKey)).rejects.toThrow();
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setExpirationTime(1)
      .sign(keys.privateKey);
    await expect(jwtVerify(expired, keys.publicKey)).rejects.toThrow();
  });
});
