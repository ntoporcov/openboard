# Agent Notes

## Commands
- Install with `npm ci` when starting from a clean checkout; `package-lock.json` is the source of truth.
- Local dev server: `npm run dev`.
- Verify changes with `npm run lint` and `npm run build`; there is no test script currently.
- `npm run build` runs `tsc -b && vite build`, so it performs the typecheck and writes production artifacts.

## App Structure
- App entrypoint is `src/main.tsx`; the current kanban UI and drag-and-drop state live in `src/App.tsx`.
- Global CSS is `src/index.css`; Tailwind v4 is loaded with `@import "tailwindcss"` and the Vite plugin in `vite.config.ts`.
- UI should stay clean and Apple-like: quiet whites/grays, subtle borders/shadows, no loud marketing hero or colorful Tailwind-style treatment.
- Use Base UI where a primitive is needed; current import pattern is `import { Button } from '@base-ui/react/button'`.
- `src/opencodeClient.ts` is a placeholder seam for OpenCode integration. It targets `VITE_OPENCODE_URL` or `http://localhost:4096` and is not wired into the UI yet.

## Reference Projects
- `/Users/mininic/opencode` contains the OpenCode source, including its web UI; use it as the primary reference for OpenCode API behavior and existing web interaction patterns.
- `/Users/mininic/xcodeprojects/opencode-ios-client` contains a Swift iOS client that also interacts with OpenCode; use it as a secondary reference for client flows and API expectations.

## GitHub Pages
- GitHub Pages is intended to deploy from branch `main` folder `/docs`, not from GitHub Actions.
- Vite is configured with `base: '/openboard/'` and `build.outDir: 'docs'`; do not change these unless the repo name or Pages strategy changes.
- `docs/` is tracked build output on purpose. After UI/source changes, run `npm run build` and commit the updated `docs/` artifacts with the source changes.

## Hooks
- `.githooks/pre-push` is the tracked hook template. This checkout also has an active `.git/hooks/pre-push` installed manually.
- The pre-push hook runs `npm run build` and rejects the push if `docs/` changes or has untracked files. If a push is blocked, commit the regenerated `docs/` artifacts and push again.

## Current Gaps
- README is still the default Vite template; trust `package.json`, `vite.config.ts`, and this file over README prose for repo workflow.
