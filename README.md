# OpenBoard

OpenBoard is a lightweight kanban UI for coordinating AI coding work with an OpenCode server.

## OpenCode Server Setup

When using the GitHub Pages build at `https://ntoporcov.github.io/openboard/`, start OpenCode with that Pages origin allowed for CORS:

```sh
opencode serve --cors https://ntoporcov.github.io
```

If you also use the local Vite dev server, allow both origins:

```sh
opencode serve --cors https://ntoporcov.github.io --cors http://localhost:5173
```

Use only the origin in `--cors`; do not include the `/openboard/` path.

## Development

```sh
npm ci
npm run dev
```

Verify changes with:

```sh
npm run lint
npm run build
```

The production build is written to `docs/` for GitHub Pages and should be committed with source changes.

## OpenCode Plugin

This repo also contains the GitHub Packages npm package for the accompanying OpenCode plugin in `packages/openboard-opencode-plugin`.

For local repo use, `opencode.json` loads `.opencode/plugins/openboard.js`. Installing or loading the plugin injects the default OpenBoard agents:

- `openboard-prepper`
- `openboard-planner`
- `openboard-builder`
- `openboard-reviewer`
- `openboard-tester`

The plugin adds `openboard_start_frontend`, `openboard_move_ticket`, and `openboard_note_ticket`. `openboard_start_frontend` serves the bundled kanban UI at `http://127.0.0.1:4789/openboard/` by default. Set `OPENBOARD_API_URL` when a board API is available; until then, tool calls still appear as OpenCode tool metadata but do not mutate the browser-only board state.

To publish the plugin from this monorepo to GitHub Packages, publish the package workspace rather than creating a separate repo:

```sh
npm publish --workspace @ntoporcov/openboard-opencode-plugin
```
