# OpenBoard OpenCode Plugin

This package provides OpenBoard workflow tools for OpenCode plus the default board agents shipped with this repo.

## Use From npm

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["openboard-opencode-plugin"]
}
```

The plugin exposes:

- `openboard_move_ticket` for agent handoffs between board lanes.
- `openboard_note_ticket` for handoff notes, blockers, findings, and test notes.

Set `OPENBOARD_API_URL` or configure the plugin as `["openboard-opencode-plugin", { "apiUrl": "http://localhost:4097" }]` when OpenBoard has a board API available. Without an API URL, the tools still record tool metadata in the OpenCode session but do not mutate board state.

## Agents

The default agents are included in `agents/` and are also checked into this repo under `.opencode/agents/` for local use:

- `openboard-prepper`
- `openboard-planner`
- `openboard-builder`
- `openboard-reviewer`
- `openboard-tester`
