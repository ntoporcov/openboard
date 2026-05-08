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

## OpenCode Plugin Status

The accompanying OpenCode plugin is still in development and is not the recommended setup path yet.

The intended plugin direction is to provide default OpenBoard agents and handoff tools for the board flow:

- `openboard-prepper`
- `openboard-planner`
- `openboard-builder`
- `openboard-reviewer`
- `openboard-tester`

For now, the GitHub Pages flow above is farther ahead: run an OpenCode server with the Pages origin allowed, then connect the hosted OpenBoard UI to that server. Plugin packaging, bundled local hosting, and agent-driven board movement still need more iteration before they should be treated as the primary install path.
