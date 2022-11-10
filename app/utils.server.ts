export function ensurePrimary() {
  const FLY_REGION = process.env.FLY_REGION;
  if (FLY_REGION !== process.env.PRIMARY_REGION) {
    throw getFlyReplayResponse();
  }
}

export function getFlyReplayResponse() {
  return new Response("Fly Replay", {
    status: 409,
    headers: { "fly-replay": `region=${process.env.PRIMARY_REGION}` },
  });
}
