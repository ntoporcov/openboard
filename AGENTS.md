# Agent Notes

## Commands
- Install with `npm ci` when starting from a clean checkout; `package-lock.json` is the source of truth.
- Local dev server: `npm run dev`.
- Verify changes with `npm run lint`, `npm run test`, and `npm run build`.
- `npm run build` runs `tsc -b && vite build`, so it performs the typecheck and writes production artifacts.

## App Structure
- App entrypoint is `src/main.tsx`; the current kanban UI and drag-and-drop state live in `src/App.tsx`.
- Global CSS is `src/index.css`; Tailwind v4 is loaded with `@import "tailwindcss"` and the Vite plugin in `vite.config.ts`.
- UI should stay clean and Apple-like: quiet whites/grays, subtle borders/shadows, no loud marketing hero or colorful Tailwind-style treatment.
- Use Base UI where a primitive is needed; current import pattern is `import { Button } from '@base-ui/react/button'`.
- `src/opencodeClient.ts` contains the browser OpenCode API client used by `src/App.tsx`; keep request shapes aligned with the OpenCode server APIs.

## Product Model
- OpenBoard is a coordination layer for AI coding work running in OpenCode. It should make the state of the work obvious, not replace OpenCode's chat, tools, or session model.
- The board is organized around a deliberate flow: Prep, Plan, Build, Review, Test, then Done or Blocked when plugin/tooling support exists for those terminal states.
- Prep is a distinct lane above the kanban columns. It is for clarifying ambiguous work before it becomes an implementation ticket.
- Plan, Build, Review, and Test are kanban columns for delegated work. Dragging a prep session into Plan or Build creates a board card and sends the configured prompt template to the selected OpenCode agent.
- A ticket should carry enough context for the next agent to continue from the OpenCode session history. Prefer handoff notes and concise prompts over duplicating entire transcripts in card fields.
- OpenBoard should expose agent handoffs, questions, permissions, and recent session activity in the sidebar so the user can supervise the workflow without losing the board overview.

## OpenCode Integration
- The browser app connects directly to an OpenCode server configured by the user. The default is `http://127.0.0.1:4096`; GitHub Pages usage requires starting OpenCode with the Pages origin allowed by CORS.
- OpenBoard creates OpenCode sessions for prep work, sends prompts to selected agents, lists messages, follows child sessions, and replies to OpenCode questions and permission requests.
- Agent choices are per board area. Defaults prefer the OpenBoard plugin agents (`openboard-prepper`, `openboard-planner`, `openboard-builder`, `openboard-reviewer`, `openboard-tester`) with fallbacks to built-in OpenCode agents when those plugin agents are unavailable.
- Prompt templates are user-editable per area. Preserve the `{{user_message}}` interpolation behavior when changing template handling.
- The OpenCode plugin injects default OpenBoard agents and tools. Until a board API is configured through `OPENBOARD_API_URL` or plugin options, `openboard_move_ticket` and `openboard_note_ticket` are metadata/handoff signals only and do not mutate the browser-only board state.

## Persistence
- Browser state is stored locally: connection settings and UI preferences in `localStorage`, prep sessions and cards in IndexedDB via `src/openboardDb.ts`.
- Do not assume state is shared across browsers or devices until an explicit board API exists.
- If adding persistent fields, consider IndexedDB versioning and migration behavior in `openDatabase()`.
- Avoid storing secrets beyond the current OpenCode connection config behavior. Be careful with logs, prompt text, and generated artifacts that may contain project paths or credentials.

## UX Guidance
- The main view should remain a board-first workspace with a collapsible right sidebar for chat/session details.
- Keep terminal or agent-management concepts understandable to a user supervising AI coding work. Prefer plain labels like Prep, Plan, Build, Review, and Test over internal implementation terms.
- Connection failures, missing agents, OpenCode permission requests, and questions should be visible and recoverable from the UI.
- Preserve keyboard/focus behavior and mobile usability when changing modals, drag-and-drop, or sidebars.

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
- README contains user-facing setup notes; trust `package.json`, `vite.config.ts`, and this file for detailed repo workflow.
