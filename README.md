# Corelum AI

A Windows 11 application foundation built with Tauri 2, Rust, React and TypeScript. Source ZIPs are reviewed by an authenticated administrator, integrated into a versioned repository, tested in CI, compiled on Windows, signed in a separate trusted job, and published through an authenticated control service.

The desktop includes Home, a modular Workspace, persistent appearance and startup settings, a system tray, administrator sign-in, ZIP selection and drag-and-drop, change review, pipeline status, release history, withdrawal, Stable/Beta channels and a native signed updater.

## Start here

- [Setup and deployment](docs/SETUP.md)
- [ZIP format and module development](docs/ZIP-FORMAT.md)
- [Architecture and recovery](docs/ARCHITECTURE.md)
- [Verification report](docs/TEST-REPORT.md)

```powershell
npm ci
npm test
npm run check:service
npm run desktop
```

Windows builds require the Visual C++ build tools, Rust stable, Node 24 or newer, and WebView2. `npm run bundle` produces an NSIS installer; set `TAURI_SIGNING_PRIVATE_KEY` in the build environment and configure the public key and service origin first.

## Distribution

The source repository remains private. Installers live in private GitHub Releases; the Cloudflare Worker streams only published installers to ordinary users without exposing a repository token. Small uploaded source archives are stored in bounded database chunks. This configuration uses Workers and D1 without requiring an R2 subscription.

New installations must use a build configured with the deployed HTTPS control-service address and the permanent update public key. An unconfigured local build deliberately reports that remote administration and updates are unavailable.

Checking happens at launch and every 20 seconds while Corelum runs, including in the system tray. Default settings download verified releases and restart after a 20-second notice. Users can select restart approval or installation on exit. Builds still take time; closed or offline installations cannot receive updates until they run online. Free hosting and private Actions quotas apply.

The update signature is separate from a Windows Authenticode publisher certificate. Authenticode configuration is optional and is not supplied with this project. Do not distribute private signing keys or local administrator setup records.
