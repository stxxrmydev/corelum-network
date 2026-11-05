# Corelum AI

Corelum AI is a Windows 11 application and hosted AI workspace. Sign in to chat with AI, customise appearance and manage updates. Administrators also have Development Studio, where source file drops become reviewed, tested and signed application releases.

The desktop includes a modular Workspace, persistent appearance and startup settings, a system tray, ZIP selection and drag-and-drop, change review, pipeline status, release history, withdrawal, Stable/Beta channels and a native signed updater. Every application page requires sign-in. Regular accounts cannot access Development Studio, and an administrator can place their workspace under maintenance.

Live app: [Corelum AI](https://corelum.nimbus-shell.workers.dev). Use the NSIS setup executable for a conventional Windows installation. The hosted site additionally provides browser access; native startup, tray and installer updates are available in the installed app.

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

Checking happens at launch and every 20 seconds while Corelum runs, including in the system tray. Default settings download verified releases and ask the user to restart. Users can select automatic restart or installation on exit. Builds still take time; closed or offline installations cannot receive updates until they run online. Free hosting and private Actions quotas apply.

Live AI uses the Worker's Cloudflare Workers AI binding. No OpenAI API key or Codex subscription credit is used by the chat. The free AI allowance can be exhausted; the app reports service errors without generating a simulated answer. Conversations are saved on the current device and separated by account.

The update signature is separate from a Windows Authenticode publisher certificate. Authenticode configuration is optional and is not supplied with this project. Do not distribute private signing keys or local administrator setup records.
