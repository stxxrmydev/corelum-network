/** RFC 6238 TOTP, SHA-1, six digits, 30-second steps. Never log secrets or codes. */
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function createTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits -= 5)) & 31];
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function decodeSecret(secret: string): Uint8Array {
  if (!/^[A-Z2-7]{32}$/.test(secret)) throw new Error("Invalid TOTP secret");
  let value = 0, bits = 0;
  const bytes: number[] = [];
  for (const c of secret) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits -= 8)) & 255);
      value &= (1 << bits) - 1;
    }
  }
  return new Uint8Array(bytes);
}
export async function totpAt(secret: string, counter: number): Promise<string> {
  if (!Number.isSafeInteger(counter) || counter < 0) throw new Error("Invalid counter");
  const key = await crypto.subtle.importKey("raw", decodeSecret(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new Uint8Array(8);
  let n = BigInt(counter);
  for (let i = 7; i >= 0; i--) { msg[i] = Number(n & 255n); n >>= 8n; }
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const offset = digest[19] & 15;
  const value = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(value % 1_000_000).padStart(6, "0");
}
export async function verifyTotp(secret: string, code: string, nowMs = Date.now()): Promise<boolean> {
  if (!/^\\d{6}$/.test(code)) return false;
  const step = Math.floor(nowMs / 30_000);
  for (const offset of [-1, 0, 1]) {
    if (step + offset >= 0 && (await totpAt(secret, step + offset)) === code) return true;
  }
  return false;
}
export function totpUri(secret: string, account: string): string {
  const label = encodeURIComponent("Corelum AI:" + account);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Corelum%20AI&algorithm=SHA1&digits=6&period=30`;
}
