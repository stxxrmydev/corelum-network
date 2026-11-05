# Setup and deployment

## Existing deployment

Repository: `https://github.com/stxxrmydev/nimbus-shell` (private).

Control service: `https://nimbus-control.nimbus-shell.workers.dev`.

The accompanying verification report records which live operations were actually verified. Administrator access and private signing material are stored separately from the source and distribution artifacts. Do not share those records with ordinary users.

## Local development

Install Node 24+, Rust stable, the Visual C++ desktop build tools and WebView2. Then:

```powershell
npm ci
npm test
npm run check:service
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run desktop
```

`npm run dev` opens a browser preview. It allows appearance/settings preview but explicitly disables administration, native startup controls and actual updates. Use `npm run desktop` for those features. There are no simulated successful deployments in preview mode.

## Recreate hosting in another account

1. Use a private GitHub repository and enable Actions. Keep the default trusted branch named `main` unless you update all matching workflow configuration.
2. Authenticate Wrangler with your Cloudflare account. No paid subscription or R2 activation is needed.
3. Create a D1 database with `npx wrangler d1 create nimbus-control` and place its ID/account ID in `service/wrangler.toml`.
4. Set `GITHUB_REPOSITORY`, `GITHUB_BRANCH` and `PUBLIC_ORIGIN` to your actual repository and Worker address. Run `npx wrangler d1 migrations apply nimbus-control --remote --config service/wrangler.toml`.
5. Create three service secrets: `GITHUB_TOKEN`, `SESSION_PEPPER`, and the temporary `BOOTSTRAP_TOKEN`. Use a repository-scoped fine-grained GitHub token with Contents read/write and Actions read/write. The integration also writes trusted, generated version files; do not allow user ZIPs to modify workflow configuration. If your GitHub permission policy requires a workflow permission for creating branches containing existing workflow files, grant it only to this service identity.
6. Generate each random service secret separately with a cryptographic generator or a password manager. Use `wrangler secret put NAME --config service/wrangler.toml` through private input, or a protected JSON file with `wrangler deploy --secrets-file PATH`. Never place secret values directly in command arguments or Git.
7. Deploy using `npx wrangler deploy --config service/wrangler.toml --var SOURCE_BASE_SHA:YOUR_INITIAL_SOURCE_COMMIT`. This exact SHA must contain the reviewed 1.0.0 source. Deployment can be performed with an empty initial secret configuration: administrator routes fail closed until `SESSION_PEPPER` is present.
8. Check `/health`, then use the one-time administrator setup below. Remove the bootstrap secret after creating the administrator.

The service's cron checks active jobs once per minute. It does not execute uploaded code. Database archive storage accepts at most 4 MiB per uploaded ZIP. Installers are retained in private GitHub Releases and streamed through the service only after publication.

## One-time administrator setup

Create an ignored local JSON file, such as `local-secrets/admin-setup.json`, containing:

```json
{
  "origin": "https://YOUR-WORKER.workers.dev",
  "email": "YOUR_ADMIN_EMAIL",
  "password": "A_UNIQUE_PASSWORD_AT_LEAST_16_CHARACTERS_LONG",
  "bootstrap": "THE_TEMPORARY_BOOTSTRAP_SECRET"
}
```

Run `node scripts/admin-setup.mjs PATH_TO_PRIVATE_JSON`. The service creates the first administrator only once, hashes the password with a random salt and refuses later setup attempts. Remove `BOOTSTRAP_TOKEN` using `wrangler secret delete BOOTSTRAP_TOKEN --config service/wrangler.toml` and securely remove the local input when it is no longer needed. Sign in inside Settings → Development & Updates. Sessions expire after eight hours and can be revoked by Sign out. Account recovery requires an operator-controlled database procedure; there is no unauthenticated password-reset endpoint.

## Permanent signing identity

Generate the Tauri update key once, retain its private half in secure backup, and keep its public half in `src-tauri/tauri.conf.json`:

```powershell
npm run tauri -- signer generate -w PATH_OUTSIDE_THE_REPOSITORY
```

Configure repository variable `TAURI_PUBLIC_KEY` with the public key text and `NIMBUS_SERVICE_URL` with the HTTPS service origin, without a trailing slash. Store `TAURI_SIGNING_PRIVATE_KEY` as an encrypted repository Actions secret; only the trusted signing job references it. If encrypted, also store `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. This works with a private repository on the free plan. Additional deployment environments and reviewer gates can be configured if your plan supports them; update the OIDC subject policy if adding an environment to the publishing job.

The trusted signing job signs the installer with `--app-version`, and clients require that signed version. Keep the public key stable across normal updates. Losing the private key breaks continuity for existing installations. This key does not replace a Windows Authenticode certificate. For a trusted publisher label in Windows, obtain a certificate or suitable signing service and add an Authenticode step in the trusted signing job before the Tauri updater signature is produced.

## Build the first distribution

For a local connected build:

```powershell
$env:NIMBUS_SERVICE_URL = 'https://YOUR-WORKER.workers.dev'
$env:PUBLIC_KEY = 'PUBLIC_KEY_TEXT'
node scripts/configure.mjs
$env:TAURI_SIGNING_PRIVATE_KEY = 'PATH_TO_YOUR_PRIVATE_KEY'
npm run bundle
```

Use the NSIS `*-setup.exe` as the conventional installer. It installs for the current Windows user, creates the Start menu entry, offers desktop shortcut support and registers its uninstaller. Preserve the application name and identifier for future releases. User settings live outside the installation directory and are not deleted by updates.

In the app, an administrator can use **Build initial release** to build 1.0.0 from the exact trusted initial source, then **Publish update** after the pipeline reaches Ready. The trusted source validation explicitly permits this initial build; all later ZIP releases must pass protected-file checks.

## Future releases entirely through the app

1. Read the current channel source SHA in Development & Updates.
2. Create a ZIP matching [ZIP-FORMAT.md](ZIP-FORMAT.md), or regenerate the example with `BASE_COMMIT` and `npm run sample`.
3. Select or drop the ZIP. Upload it and review all file changes and notes.
4. Approve the build. The service writes the source branch and dispatches GitHub Actions without exposing the publishing credential to the desktop.
5. Watch the stages. Failed builds are never published. Publish a Ready build, or enable the optional publish-on-pass policy for already-approved archives.
6. Running online clients discover the release at their next check, download and verify it, then install according to their saved preference.

Stable and Beta have independent source heads and version histories. Withdrawing a release blocks future selection/download; recover already-updated clients by releasing known-good functionality with a higher version.

## Verification and troubleshooting

Run `npm test`, `npm run build`, `npm run check:service`, and the native tests before release. `npx playwright test` verifies navigation and settings against the browser preview. Tests that create fictitious metadata do not constitute a signed native installation test; the report distinguishes those cases.

If a build is Failed, inspect the associated GitHub Actions run. Repository dispatch errors usually indicate token permissions, a missing workflow on main, or a stale source SHA. A Ready build requires a signed installer in GitHub Releases and an OIDC-authenticated registration record. If the public feed is 204, there is no higher approved release for that version/channel. 401 on administrator endpoints requires signing in again. Network failures retry without changing the installed executable.

The demo installers use a separate `com.nimbus.foundation.demo` identity and a loopback-only test feed. They are for local verification and must not be distributed as production builds. Their HTTP test exception does not exist in the normal configuration. Read the demo instructions supplied alongside them before testing.

## Backups and operating limits

Retain the private signing key, service secrets, repository history, signed installers and administrator recovery record securely. Export D1 before destructive migrations; the migration runner does not back up unrelated application data automatically. Monitor GitHub Actions and Cloudflare free usage. Nothing in these scripts upgrades an account to a paid plan or activates R2 billing.
