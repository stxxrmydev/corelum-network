# Development ZIP format

An archive contains `update.json` at its root and only files to add or replace. Include files directly; do not wrap them in a project directory or include directory-only ZIP entries.

```text
update.json
src/features/ideas/index.tsx
src/ui/ideas.css
public/ideas-icon.png
```

```json
{
  "schema": 1,
  "version": "1.0.1",
  "baseVersion": "1.0.0",
  "baseCommit": "EXACT_40_CHARACTER_SHA_FROM_THE_ADMIN_SCREEN",
  "channel": "stable",
  "minShellVersion": "1.0.0",
  "notes": "Introducing the Ideas page.",
  "remove": [],
  "urgent": false
}
```

Use a strictly higher semantic version. Stable versions cannot have a prerelease suffix. Beta versions may use `1.1.0-beta.1`. `baseVersion` and `baseCommit` must match the current channel source. The service rejects stale archives; rebase a patch after another release advances the channel. `minShellVersion` must not exceed the base version. Release notes are limited to 8,000 characters. Declare file deletions explicitly in `remove`; omitting a file does not delete it.

## Permitted content

- `src/features/**`: `.ts`, `.tsx`, `.css`, `.json`
- `src/ui/**`: `.ts`, `.tsx`, `.css`, `.json`
- `public/**`: `.png`, `.jpg`, `.webp`, `.svg`, `.ico`, `.txt`, `.json`

Archives are limited to 4 MiB compressed, 8 MiB total expanded data, 2 MiB per file, 100 files and a maximum compression ratio of 100:1. Only stored or DEFLATE entries are accepted. Paths must use ASCII letters, digits, `_`, `-`, `.`, and `/`. Traversal, absolute paths, drive names, Windows reserved names, links, special files, case collisions, overlapping entries, local/central header mismatches and CRC failures are rejected.

Core Rust code, authentication, updater settings, dependencies, workflows, secrets, service code and security policy cannot be changed by this ZIP lane. Those changes require a maintainer-reviewed repository change and the normal trusted release process. This is intentional additional review for privileged changes. Database migrations are also maintained through the repository and the numbered migration runner.

## Feature registration

Create `src/features/<id>/index.tsx` and export a feature descriptor:

```tsx
import type { Feature } from '../../core/types';
function Reports() { return <h1>Reports</h1>; }
export default {
  id: 'reports',
  title: 'Reports',
  description: 'Your reports',
  component: Reports
} satisfies Feature;
```

The build discovers modules using Vite's static import glob. IDs must be unique and cannot replace Home, Settings or Development. The new module becomes a navigation item after the rebuilt application is installed. There is no downloaded-code execution in the installed app.

React escapes normal text content; do not introduce raw HTML rendering for untrusted content. Uploaded feature code is reviewed source and runs with the application's frontend privileges after a signed build. Archive validation does not prove that feature logic is benign; administrators must review the proposed changes.

## Sample

The sample generator creates an Ideas page with persistent local notes, completion and deletion:

```powershell
$env:BASE_COMMIT = 'SOURCE_SHA_FROM_THE_ADMIN_SCREEN'
npm run sample
```

Upload `samples/ideas-1.0.1.zip`, review the new file, approve the build and publish when Ready. The delivered sample ZIP is tied to the source revision recorded with the release artifacts; regenerate it if your channel has advanced.
