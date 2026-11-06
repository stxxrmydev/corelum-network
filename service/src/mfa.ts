import { createTotpSecret, totpUri, verifyTotp } from "./totp";
export { verifyTotp };
const encoder = new TextEncoder();
function hex(bytes: Uint8Array): string { return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); }
function unhex(value: string): Uint8Array { if (!/^(?:[0-9a-f]{2})+$/.test(value)) throw new Error("Invalid ciphertext"); return new Uint8Array(value.match(/../g)!.map(b => parseInt(b, 16))); }
async function key(pepper: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode("corelum-totp-encryption-v1:" + pepper));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptTotp(secret: string, pepper: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv}, await key(pepper), encoder.encode(secret)));
  return hex(iv) + ":" + hex(encrypted);
}
export async function decryptTotp(payload: string, pepper: string): Promise<string> {
  const [iv, ciphertext] = payload.split(":");
  if (!iv || !ciphertext || iv.length !== 24) throw new Error("Invalid encrypted secret");
  const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv:unhex(iv)}, await key(pepper), unhex(ciphertext));
  return new TextDecoder().decode(plain);
}
export { createTotpSecret, totpUri };
