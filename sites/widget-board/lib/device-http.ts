import { authenticateDevice, type DeviceRepository } from "./device-pairing.ts";
import { boardId, currentBoardId, json, type BoardRepository } from "./boards.ts";

export async function handleDeviceRead(request: Request, devices: DeviceRepository, boards: BoardRepository, id?: string): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Device connections are read-only." }, 405);
  try {
    const connection = await authenticateDevice(request, devices);
    if (!connection) return json({ error: "Reconnect this iPhone in Widget Board." }, 401);
    if (id !== undefined && !boardId.safeParse(id).success) return json({ error: "Invalid board name." }, 400);
    const board = await boards.get(connection.ownerId, currentBoardId);
    if (id === undefined) return json({ boards: board ? [board] : [] });
    return board ? json(board) : json({ error: "Board not found." }, 404);
  } catch { return json({ error: "Board storage is unavailable. Please retry." }, 503); }
}
