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
