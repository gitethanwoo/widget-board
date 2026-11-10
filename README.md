# widget-board

Let an agent put content on an iPhone home screen widget.

An agent calls the `set_board` MCP tool with a small JSON spec. The server
validates it against a fixed component catalog and stores it. A WidgetKit
widget fetches the board and draws it with native SwiftUI.

```
agent ──MCP set_board──▶ server (validate, store) ◀──GET /boards/:id── widget
```

## Status

Local prototype. The server binds to localhost with no auth, and the app
points at `http://127.0.0.1:4747`, so it works in the iOS Simulator only.

## Run the server

```bash
cd server && npm install && npm run start
```

- MCP endpoint: `http://127.0.0.1:4747/mcp` (streamable HTTP, stateless)
- `GET /boards/:id` returns `{ id, spec, updatedAt }`
- `PUT /boards/:id` with `{ "spec": ... }` for non-MCP callers

## Run the app

```bash
cd ios && xcodegen generate && open WidgetBoard.xcodeproj
```

Run the `WidgetBoard` scheme on a simulator, then add the **Board** widget to
the home screen. Long-press the widget and choose Edit Widget to pick a board
name (default `budget`).

## Spec format

Specs use [json-render](https://github.com/vercel-labs/json-render)'s flat
format. Components are defined in `server/src/catalog.ts` and drawn in
`ios/Shared/BoardView.swift`; a new component needs both.

```json
{
  "root": "board",
  "elements": {
    "board": { "type": "Board", "props": { "title": "Budget" }, "children": ["left"] },
    "left": {
      "type": "Stat",
      "props": { "label": "Left this month", "value": "$1,240", "caption": "of $4,000", "tone": "good" },
      "children": []
    }
  }
}
```

| Component  | Props                                   |
| ---------- | --------------------------------------- |
| `Board`    | `title`                                 |
| `Row`      | (none) lays out 2–3 children side by side |
| `Stat`     | `label`, `value`, `caption`, `tone`     |
| `Progress` | `label`, `value` (0–1), `caption`, `tone` |
| `Note`     | `text`, `loud`                          |

`tone` is one of `default`, `accent`, `good`, `warn`, `bad`.
