import { describe, it, expect } from "vitest";
import { selectRelease, validVersion, type Release } from "../shared/release";
const r = (version: string, channel = "stable", withdrawn = 0) =>
  ({ version, channel, withdrawn, urgent: false }) as Release;
describe("release selection", () => {
  it("compares semantic numeric versions", () =>
    expect(
      selectRelease([r("1.0.9"), r("1.0.10")], "stable", "1.0.0")?.version,
    ).toBe("1.0.10"));
  it("never downgrades or reinstalls the same version", () =>
    expect(
      selectRelease([r("1.0.0"), r("0.9.0")], "stable", "1.0.0"),
    ).toBeUndefined());
  it("does not cross channels", () =>
    expect(
      selectRelease([r("1.1.0-beta.1", "beta")], "stable", "1.0.0"),
    ).toBeUndefined());
  it("skips withdrawn releases", () =>
    expect(
      selectRelease([r("1.0.1", "stable", 1)], "stable", "1.0.0"),
    ).toBeUndefined());
  it("does not force a downgrade after withdrawal", () =>
    expect(
      selectRelease([r("1.0.2", "stable", 1), r("1.0.1")], "stable", "1.0.2"),
    ).toBeUndefined());
  it("accepts a forward recovery release", () =>
    expect(selectRelease([r("1.0.3")], "stable", "1.0.2")?.version).toBe(
      "1.0.3",
    ));
  it("ignores urgent older releases", () =>
    expect(
      selectRelease([{ ...r("1.0.1"), urgent: true }], "stable", "1.0.2"),
    ).toBeUndefined());
  it("rejects malformed installed versions", () =>
    expect(() => selectRelease([], "stable", "nonsense")).toThrow());
  it("validates channel version format", () => {
    expect(() => validVersion("1.0.1-beta.1", "stable")).toThrow();
    expect(validVersion("1.0.1-beta.1", "beta")).toBe("1.0.1-beta.1");
  });
});
