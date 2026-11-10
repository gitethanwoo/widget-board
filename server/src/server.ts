import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { catalogReference, checkSpec, specSchema } from "./spec.js";
import { boardId, getBoard, listBoards, saveBoard } from "./store.js";

const PORT = Number(process.env.PORT ?? 4747);

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "widget-board", version: "0.1.0" });

  server.registerTool(
    "set_board",
    {
      title: "Set widget board",
      description: [
        "Replace what a home screen widget shows. The widget displaying this board picks up the change on its next refresh (minutes, not seconds).",
        "The spec is a flat json-render tree: `root` names the root element, and `elements` maps keys to { type, props, children }.",
        "Widgets are small and cannot scroll: a small widget fits about 2 leaf blocks, a medium widget about 4.",
        "Components:",
        catalogReference(),
      ].join("\n"),
      inputSchema: {
        board: boardId.describe('Board to update, e.g. "budget" or "note". Created if it does not exist.'),
        spec: specSchema,
      },
    },
    async ({ board, spec }) => {
      const check = checkSpec(spec);
      if (!check.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: `Spec rejected:\n- ${check.problems.join("\n- ")}` }],
        };
      }
      const saved = await saveBoard(board, check.spec);
      return {
        content: [{ type: "text", text: `Board "${saved.id}" updated at ${saved.updatedAt}.` }],
      };
    },
  );

  server.registerTool(
    "get_board",
    {
      title: "Get widget board",
      description: "Read the spec a board currently shows, e.g. before changing one value in it.",
      inputSchema: { board: boardId },
    },
    async ({ board }) => {
      const found = await getBoard(board);
      if (!found) {
        const known = (await listBoards()).map((b) => b.id);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `No board "${board}". Existing boards: ${known.length > 0 ? known.join(", ") : "(none)"}.`,
            },
          ],
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(found, null, 2) }] };
    },
  );

  return server;
}

// Binds to 127.0.0.1 with DNS-rebinding protection. There is no auth yet, so
// this must not be exposed beyond localhost as-is.
const app = createMcpExpressApp();

app.post("/mcp", async (req: Request, res: Response) => {
  // Stateless: a fresh server and transport per request, per the SDK example.
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Plain HTTP API: what the widget reads, and what non-MCP callers can write.
app.get("/boards/:id", async (req: Request<{ id: string }>, res: Response) => {
  const board = await getBoard(req.params.id);
  if (!board) {
    res.status(404).json({ error: `No board "${req.params.id}".` });
    return;
  }
  res.json(board);
});

app.put("/boards/:id", async (req: Request<{ id: string }>, res: Response) => {
  const id = boardId.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "Invalid board id.", problems: id.error.issues.map((i) => i.message) });
    return;
  }
  const body: unknown = req.body;
  const spec = typeof body === "object" && body !== null && "spec" in body ? body.spec : undefined;
  const check = checkSpec(spec);
  if (!check.ok) {
    res.status(422).json({ error: "Spec rejected.", problems: check.problems });
    return;
  }
  res.json(await saveBoard(id.data, check.spec));
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`widget-board listening on http://127.0.0.1:${PORT} (MCP at /mcp)`);
});
