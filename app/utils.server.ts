export function ensurePrimary() {
  if (process.env.FLY_REGION !== process.env.PRIMARY_REGION) {
    console.log(
      `${process.env.FLY_REGION} is not primary (primary is: ${process.env.PRIMARY_REGION}), sending fly replay response`
    );
    throw getFlyReplayResponse();
  }
}

export function getFlyReplayResponse() {
  return new Response("Fly Replay", {
    status: 409,
    headers: { "fly-replay": `region=${process.env.PRIMARY_REGION}` },
  });
}
