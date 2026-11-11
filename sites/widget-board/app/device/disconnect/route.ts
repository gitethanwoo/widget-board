import { authenticateDevice } from "../../../lib/device-pairing";
import { devices } from "../../../lib/device-store";
import { json } from "../../../lib/boards";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const connection = await authenticateDevice(request, devices);
  if (!connection) return json({ error: "Device connection not found." }, 401);
  await devices.remove(connection.ownerId, connection.id);
  return json({ disconnected: true });
}
