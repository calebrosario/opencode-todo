# opencode-todo

A todo task list for **OpenCode V2** — restores the todo workflow V1 had, built
entirely on the V2 plugin API (no fork required).

OpenCode V2 removed the built-in todo list: there is no todo tool for the model
and no todo panel in the TUI. This plugin brings both back:

- **`todo` tool** — the model-facing tool (`add` / `start` / `complete` /
  `remove` / `list`) so the agent tracks its own multi-step work, V1-style.
- **TUI session panel** — a live, interactive panel (`/todo` or the command
  palette → "Open todo list") showing the list with keyboard controls.
- **Context injection** *(optional, on by default)* — open todos are pushed
  into the system context on every model request so the agent stays on task.
- **Live sync** — the server half and the TUI half communicate over plugin
  RPC, so tool mutations appear in the panel instantly.
- **Durable state** — todos persist across restarts via plugin storage.

## Install

OpenCode `2.0.4+`.

```jsonc
// opencode.json
{
  "plugins": [
    "opencode-todo@git+https://github.com/calebrosario/opencode-todo.git"
  ]
}
```

Or from a local checkout (path must be the plugin *directory*; V2 rejects
direct `.ts` file paths):

```jsonc
{
  "plugins": ["/absolute/path/to/opencode-todo"]
}
```

The CLI plugin (`src/tui.tsx`) is auto-loaded through the package's `./tui`
export — no separate `cli.json` entry needed. TUI plugins require the terminal
client (OpenCode desktop/web clients will simply skip the panel).

## The todo tool

The model calls it like any other tool:

```json
{ "action": "add", "content": "Port rtk-bridge to the V2 hook API" }
{ "action": "start", "id": "1" }
{ "action": "complete", "id": "1" }
{ "action": "list" }
```

Only one todo is `in_progress` at a time — starting one demotes the previous.

## Panel keybinds

| Key | Action |
|-----|--------|
| `j` / `k`, arrows | Move selection |
| `g` / `G` | First / last |
| `space` | Toggle complete |
| `a` | Add (prompt dialog) |
| `d` | Remove selected |
| `r` | Refresh |
| `f` | Toggle fullscreen |

Open with `/todo`, `/todos`, or the command palette.

## Options

```jsonc
{
  "plugins": [
    {
      "package": "opencode-todo@git+https://github.com/calebrosario/opencode-todo.git",
      "options": { "injectContext": false }
    }
  ]
}
```

- `injectContext` (default `true`) — push open todos into the system context
  of every model request.

## Architecture

```
src/rpc.ts    Todo RPC contract (methods: list/add/toggle/remove, event: updated)
src/index.ts  Server plugin: todo tool (ctx.tool.transform), storage,
              optional context hook (ctx.session.hook)
src/tui.tsx   CLI plugin: session.panel slot + keybinds/slash command,
              reactive Solid view over the RPC
```

The server half owns the state. Every mutation persists to `ctx.storage` and
emits `updated`; the panel re-fetches via the RPC `list` method.

## License

MIT © Caleb Rosario
