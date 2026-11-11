import { authenticatedOwner, boardId, currentBoardId, checkWriteOrigin, errorText, json, readJson, validateBoardSpec, type BoardRepository } from "./boards.ts";

export async function handleBoards(request: Request, repository: BoardRepository, id?: string) {
  const owner = authenticatedOwner(request);
  if (!owner) return json({ error: "Sign in with ChatGPT to access your boards." }, 401);
  if (id !== undefined && !boardId.safeParse(id).success) return json({ error: "Invalid board name." }, 400);
  if (request.method === "GET") {
    try {
      const board = await repository.get(owner, currentBoardId);
      if (!id) return json({ boards: board ? [board] : [] });
      return board ? json(board) : json({ error: "Board not found." }, 404);
    } catch { return json({ error: "Board storage is unavailable. Please retry." }, 503); }
  }
  if (request.method !== "PUT" || !id) return json({ error: "Method not allowed." }, 405);
  try { checkWriteOrigin(request); } catch { return json({ error: "Forbidden origin." }, 403); }
  let spec;
  try {
    const input = await readJson(request);
    spec = validateBoardSpec(typeof input === "object" && input !== null && "spec" in input ? input.spec : undefined);
  } catch (error) { return json({ error: errorText(error) }, 422); }
  try { return json(await repository.save(owner, currentBoardId, spec)); }
  catch { return json({ error: "Board storage is unavailable. Please retry." }, 503); }
}
