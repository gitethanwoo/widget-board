import { authenticatedOwner, json } from "../../../../lib/boards";
import { devices } from "../../../../lib/device-store";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = authenticatedOwner(request);
  if (!owner) return json({ error: "Sign in with ChatGPT." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Forbidden origin." }, 403);
  await devices.remove(owner, (await context.params).id);
  return Response.redirect(new URL("/devices", request.url), 303);
}
