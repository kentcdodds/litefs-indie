export function ensurePrimary() {
  if (!process.env.IS_PRIMARY) {
    console.log(
      `Instance (${process.env.FLY_INSTANCE}) in ${process.env.FLY_REGION} is not primary (primary is: ${process.env.PRIMARY_INSTANCE}), sending fly replay response`
    );
    throw getFlyReplayResponse();
  }
}

export function getFlyReplayResponse() {
  return new Response("Fly Replay", {
    status: 409,
    headers: { "fly-replay": `instance=${process.env.PRIMARY_INSTANCE}` },
  });
}
