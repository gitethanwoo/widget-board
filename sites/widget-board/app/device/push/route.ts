import { devices } from "../../../lib/device-store";
import { pushes, pushConfig } from "../../../lib/push-store";
import { handlePushRegistration } from "../../../lib/widget-push";
import { json } from "../../../lib/boards";

export const dynamic = "force-dynamic";
export async function PUT(request: Request) {
  try { return await handlePushRegistration(request, devices, pushes, !!pushConfig()); }
  catch { return json({ error: "Widget push registration is unavailable. Please retry." }, 503); }
}
