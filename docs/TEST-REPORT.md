# Verification report

Date: 5 November 2026. Target: Windows 11 x64. Product: Corelum AI.

## Automated checks

- **57 TypeScript tests passed** across archive validation, CRC integrity, decompression limits, protected paths, manifest compatibility, semantic versions, independent channels, withdrawal, salted password hashing, session validation, CI identity rejection and Worker/D1 authentication/publication transactions.
- **6 browser UI checks passed** for sign-in protection, administrator and regular-account navigation, maintenance behavior, persisted appearance/conversations and minimum window width. These local UI tests mock service responses to isolate interface behavior.
- **3 native Rust tests passed** for settings validation, schema defaults, persistence and backup creation.
- Frontend production build and service TypeScript checks passed.
- The dependency audit reported **0 known vulnerabilities** at the time of verification.
- A production Corelum AI 1.0.1 Windows executable and NSIS installer were built locally. The updater signature binds the installer bytes to its advertised version.

## Real hosted application

The live application is [Corelum AI](https://corelum.nimbus-shell.workers.dev). Ten browser checks ran against the deployed service without mocked network responses:

1. Anonymous visitors see sign-in only.
2. The configured administrator can sign in.
3. Web sessions use a Secure HttpOnly cookie.
4. Accent and theme choices persist after reload.
5. AI chat returns a real Cloudflare Workers AI response.
6. The conversation persists after reload.
7. The administrator can enable maintenance in Development Studio.
8. A regular member sees maintenance after signing in.
9. The server denies administrator APIs to that member, including when registration input requests an administrator role.
10. Disabling maintenance restores regular workspace access while keeping Development Studio hidden.

No browser runtime errors were recorded. Maintenance was left off. The delivered `Live-web-verification.json` contains the machine-readable result. Final Settings and Workspace screenshots were captured from the hosted app.

The AI binding uses `@cf/meta/llama-3.1-8b-instruct-fp8`. No OpenAI API credential or Codex subscription allocation is used by app chat. No paid plan or R2 subscription was activated. Quotas and outages can still stop requests.

## Remote release verification

The original publication failure was traced to GitHub's immutable OIDC subject format, which includes account and repository IDs. The service now validates those IDs alongside the signed issuer, audience, repository, branch, trusted workflow and run identity. The authorization checks remain enabled.

The first remote Windows release, 1.0.0, passed isolated tests, compilation, trusted signing and publication. A public update-feed download was fetched, its SHA-256 matched the private build manifest, and its Minisign/Tauri signature and bound version were independently verified using the updater's verification library. Requests for the same installed version returned HTTP 204.

**Stable Corelum AI 1.0.1 is published.** Its complete [remote pipeline](https://github.com/stxxrmydev/corelum-network/actions/runs/42119892706) passed validation/testing, Windows compilation, separate signing and release staging. Deployment ID: `f2183dc8-092f-4951-a3d0-4bf3563eedf0`. Source: `1790c4ffe9e9f68e1d65982844b1b500aa6e64fa`.

The public Stable feed advertised 1.0.1 to a 1.0.0 client. The installer was downloaded through the live service, matched the private build manifest, and passed independent cryptographic signature and bound-version verification. The same-version feed returned HTTP 204. The delivered setup file is this remotely built and verified artifact, rather than the earlier local build.

- Installer size: **2,750,176 bytes**.
- Installer SHA-256: `6eb000a86dbff87008e13134e9b62e7246f37e8f05956f0d57bafe84a278046f`.

**A real uploaded ZIP completed the full release path.** The Ideas file drop was uploaded to the authenticated service, validated, reviewed/approved, integrated into a Git branch and dispatched through the [Beta pipeline](https://github.com/stxxrmydev/corelum-network/actions/runs/42119906653). All four jobs passed. Beta 1.0.1-beta.1 published successfully; its public installer download matched the recorded hash and passed signature/bound-version verification. The test release was then withdrawn: Beta selection returned HTTP 204 and the artifact URL returned HTTP 404. This avoids continuing to distribute a QA build based on the older interface.

The delivered `Release-stable-verification.json` and `Release-beta-verification.json` record the source SHAs, installer hashes, signature checks and withdrawal result. These real service results are distinct from the mocked local UI tests.

## Native installation boundary

The Windows executable and installer compile successfully. Installation and an actual installed-client upgrade/restart have **not** been verified end to end. Automatic approval review rejected execution of an earlier demo installer with “blocked by policy.” The later Windows screen check was stopped by the user with Escape, and computer control stopped.

To complete that check, the user should run the delivered Corelum AI setup file in File Explorer, sign in, then publish a higher compatible sample version and use the offered restart action. Verify the new version, retained preferences and new Ideas module after restart. The old Nimbus Demo uses a separate identity and does not verify production update continuity.

No Authenticode publisher certificate is configured. A valid Tauri updater signature does not supply a Windows verified-publisher label. Automatic boot-health rollback, large-user rollout and sustained free-tier capacity have not been verified.
