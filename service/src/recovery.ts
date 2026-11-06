/** One-time recovery codes. Store only peppered SHA-256 digests, never plaintext. */
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
export function createRecoveryCodes(count = 10): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("Invalid recovery code count");
  return Array.from({length:count}, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    const value = hex(bytes).toUpperCase();
    return value.slice(0,10) + "-" + value.slice(10);
  });
}
export function normalizeRecoveryCode(value: string): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/[ -]/g, "").toUpperCase();
  return /^[0-9A-F]{20}$/.test(code) ? code : null;
}
export async function recoveryCodeDigest(code: string, accountId: string, pepper: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized || !accountId || !pepper) throw new Error("Invalid recovery code");
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode("corelum-recovery-v1:"+accountId+":"+pepper+":"+normalized));
  return hex(new Uint8Array(bytes));
}
