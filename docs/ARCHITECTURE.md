# Architecture and recovery

## Implementation plan and structure

1. Build the Tauri shell, navigation, module registry, persistent settings, tray and startup controls.
2. Implement server-side administrator setup, salted password hashing, expiring sessions, throttling, ZIP validation and exact source-revision review.
3. Integrate reviewed changes into Git, dispatch the trusted Windows pipeline, separate untrusted validation/compilation from signing, and publish channel metadata.
4. Use Tauri's maintained updater for signatures, version comparison, background download and installer launch.
5. Create a sample feature release, test the boundaries, compile Windows artifacts and document operational gaps.

| Area | Location | Responsibility |
|---|---|---|
| Native core | `src-tauri/src` | Fixed service endpoint, settings, credentials, upload transport, updater, tray |
| Interface | `src/main.tsx`, `src/ui` | Shell, Settings and administrator workflow |
| Modules | `src/features` | Statically compiled extension pages |
| ZIP policy | `shared/archive.ts` | Bounded decompression, integrity and path rules |
| Control service | `service/src` | Authentication, authorization, source integration, pipeline status, feeds |
| Persistence | `service/migrations` | Versioned D1 schema and bounded archive storage |
| CI | `.github/workflows` | Checks, isolation, Windows packaging, signing and staging |

The Worker uses TypeScript to share the archive and version policy with tests, Web Crypto for credentials, D1 for transactional metadata and small archive chunks, and GitHub's API for versioned source and private release assets. This avoids a permanently running server and an object-storage billing activation. No paid plan is enabled by the project setup.

## Trust boundaries

The desktop has a compile-time HTTPS service origin. Ordinary users cannot change it through Settings. Public installer downloads do not need administrator credentials. Every upload, approval, policy, publication and withdrawal endpoint performs a server-side session lookup. Session tokens are hashed in D1, expire after eight hours, and are stored by the native app in Windows Credential Manager. Passwords use salted PBKDF2 through Web Crypto. Login/setup requests are rate limited using a peppered IP identifier; plaintext IPs and passwords are not logged.

The repository credential exists only in the service secret store. The update private key exists only in protected local setup storage and the signing environment. It is not in Git or in distributed application files. Signing and publishing jobs check out trusted main-branch tooling. Candidate builds receive no signing or publishing secret. The validation container has no network, a read-only source mount, dropped capabilities, no host write access, and CPU/memory/process limits. Windows compilation runs on a disposable GitHub-hosted VM with no persisted checkout credential and no release secrets.

Only the trusted publishing job can register release metadata. The service validates GitHub's signed OIDC token, audience, repository, branch, workflow path, and deployment run name, then checks the actual release asset. The private GitHub download credential is never forwarded to the desktop or to a redirected object-storage host.

Tauri verifies the installer signature and its signed version before installation. A manifest cannot relabel an old signed binary as a new version. Channel selection also refuses an equal or lower version. Protected-file checks in CI independently verify the ZIP integration restrictions and generated version changes.

## Release lifecycle

Upload → validate → review → approve → integrate into a new source branch → isolated tests → Windows build → trusted signing → GitHub Release staging → Ready → publish. The desktop polls build status every six seconds while administration is open. A one-minute service cron also checks active builds and applies the optional publish-on-pass policy, so closing the administrator window does not stop the pipeline.

Published metadata becomes available immediately at the service; running online clients find it at the next 20-second check. Build queues, compilation, signing and downloads take time. This is a pull-based updater; it does not claim instant remote execution on every PC.

## Persistence and installation

The app identifier remains `com.corelum.network`. Tauri's per-user app-data directory stores settings, a last-known settings backup, update history and a pending-install marker. WebView2's local storage holds module data. The installer uses NSIS in current-user mode, with a stable application name, Start menu identity and uninstaller. It does not write source patches into the installed directory. The maintained updater launches the signed installer; Windows exits the running application as part of that process.

Settings have a schema version and validated defaults for newly introduced fields. Writes stage and flush a temporary file before replacement and retain a backup. Service schema changes use numbered migrations. Future destructive data migrations must include a backup and a separately reviewed recovery procedure; arbitrary migrations are not allowed through feature ZIPs.

## Failure and recovery

- A network or signature failure leaves the installed executable untouched and reports an error. The background loop retries; partial bytes are discarded and a fresh download is verified.
- A channel switch invalidates the previous channel's staged update before installation.
- The pending-install marker records source/target versions before installer launch. The next launch records success or an incomplete attempt in local update history. Settings and module data remain outside the installation directory.
- Withdraw a defective release to stop new feed selection and new downloads. Clients that already installed it are not remotely downgraded.
- Publish known-good code under a higher version to recover, for example rebuild 1.0.1 functionality as 1.0.3 after a bad 1.0.2. The source branch remains version controlled.
- There is no claimed automatic boot-health rollback or atomic binary snapshot restoration. A failure that prevents the app launching may require running a known-good installer. Retain signed installers and signing-key backups.
- If source integration or CI dispatch fails, the deployment becomes Failed. No candidate is published. If a workflow fails, fix the underlying problem and upload a new version; a failed version number remains reserved for auditability.

## Free-tier limits

The service uses Workers and D1 free allowances; private GitHub Actions has a monthly execution allowance. No payment method or paid subscription is configured by the setup scripts. Free quotas can stop requests or builds when exhausted. At a 20-second interval, one continuously running client makes approximately 4,320 checks daily; capacity planning is necessary before wide distribution. Archive storage is deliberately bounded and installers stream from GitHub rather than occupying the database. Monitor storage and Actions usage; do not promise unlimited free distribution.

References: [Tauri updater](https://v2.tauri.app/plugin/updater/), [Windows packaging](https://v2.tauri.app/distribute/windows-installer/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
