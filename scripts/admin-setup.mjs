import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
if (process.argv.includes("--generate")) {
  console.log(
    "Generate and save two separate service secrets using your password manager or:",
  );
  console.log(
    "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
  process.exit(0);
}
// Read inputs through environment or a local, untracked JSON file; do not put credentials in command arguments.
import { readFileSync } from "node:fs";
const input = JSON.parse(
  readFileSync(process.argv[2] || "local-secrets/admin-setup.json", "utf8"),
);
const origin = new URL(input.origin);
if (
  origin.protocol !== "https:" &&
  origin.hostname !== "127.0.0.1" &&
  origin.hostname !== "localhost"
)
  throw Error("HTTPS is required");
const response = await fetch(new URL("/auth/setup", origin), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: input.email,
    password: input.password,
    bootstrap: input.bootstrap,
  }),
});
const result = await response.json();
if (!response.ok) throw Error(result.error);
console.log(
  "Administrator created. Remove the BOOTSTRAP_TOKEN service secret and delete the local setup input.",
);
