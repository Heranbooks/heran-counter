import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const totalSeconds = (await redis.get("heran:total_seconds")) || 0;
  res.status(200).json({ totalSeconds: Number(totalSeconds) });
}
