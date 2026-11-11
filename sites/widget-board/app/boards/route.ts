import { handleBoards } from "../../lib/http";
import { repository } from "../../lib/store";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleBoards(request, repository);
