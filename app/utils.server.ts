import fs from "fs";
import os from "os";

export async function ensurePrimary() {
  const currentInstance = os.hostname();
  let primaryInstance;
  try {
    primaryInstance = await fs.promises.readFile(
      "/litefs/data/.primary",
      "utf8"
    );
    primaryInstance = primaryInstance.trim();
  } catch (error: unknown) {
    primaryInstance = currentInstance;
  }

  if (primaryInstance !== currentInstance) {
    console.log(
      `Instance (${currentInstance}) in ${process.env.FLY_REGION} is not primary (primary is: ${primaryInstance}), sending fly replay response`
    );
    throw new Response("Fly Replay", {
      status: 409,
      headers: { "fly-replay": `instance=${primaryInstance}` },
    });
  }
}
