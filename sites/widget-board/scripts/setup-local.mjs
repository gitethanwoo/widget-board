import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";

// A clone has no binding to anyone else's hosted Site. Publication adds the
// project_id to this ignored manifest using the Sites tooling.
const directory = new URL("../.openai/", import.meta.url);
await mkdir(directory, { recursive: true });
try {
  await copyFile(new URL("hosting.example.json", directory), new URL("hosting.json", directory), constants.COPYFILE_EXCL);
  console.log("Created local hosting configuration.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Keeping existing hosting configuration.");
}
