import { handleDeviceRead } from "../../../../lib/device-http";
import { devices } from "../../../../lib/device-store";
import { repository } from "../../../../lib/store";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleDeviceRead(request, devices, repository, (await context.params).id);
}
