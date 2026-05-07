# OpenBoard OpenCode Plugin

This package provides OpenBoard workflow tools and default board agents for OpenCode.

## Use From GitHub Packages

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@ntoporcov/openboard-opencode-plugin"]
}
```

The plugin exposes:

- `openboard_start_frontend` to run the bundled kanban frontend locally.
- `openboard_move_ticket` for agent handoffs between board lanes.
- `openboard_note_ticket` for handoff notes, blockers, findings, and test notes.
- Default primary agents: `openboard-prepper`, `openboard-planner`, `openboard-builder`, `openboard-reviewer`, and `openboard-tester`.

The local frontend defaults to `http://127.0.0.1:4789/openboard/`. Override it with `OPENBOARD_FRONTEND_HOST`, `OPENBOARD_FRONTEND_PORT`, or plugin options `{ "frontendHost": "127.0.0.1", "frontendPort": 4789 }`.

Set `OPENBOARD_API_URL` or configure the plugin as `["@ntoporcov/openboard-opencode-plugin", { "apiUrl": "http://localhost:4097" }]` when OpenBoard has a board API available. Without an API URL, the tools still record tool metadata in the OpenCode session but do not mutate board state.
