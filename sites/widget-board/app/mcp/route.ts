import { handleMcp } from "../../lib/mcp";
import { repository } from "../../lib/store";

export const dynamic = "force-dynamic";
export const POST = (request: Request) => handleMcp(request, repository);
export const GET = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
export const DELETE = GET;
