import { handleBoards } from "../../../lib/http";
import { repository } from "../../../lib/store";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return handleBoards(request, repository, (await context.params).id); }
export const PUT = GET;
