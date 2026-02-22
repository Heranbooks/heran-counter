import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const order = req.body;
  const orderId = String(order?.id || "");

  if (!orderId) return res.status(400).send("Missing order id");

  // Anti-duplicados: Shopify puede reenviar webhooks
  const processedKey = `heran:processed_order:${orderId}`;
  const already = await redis.get(processedKey);
  if (already) return res.status(200).json({ ok: true, skipped: true });

  const lineItems = Array.isArray(order?.line_items) ? order.line_items : [];

  // Cuenta unidades cuyo título contenga "book"
  const bookUnits = lineItems.reduce((sum, item) => {
    const title = String(item?.title || "").toLowerCase();
    const qty = Number(item?.quantity || 0);
    return title.includes("book") ? sum + qty : sum;
  }, 0);

  const secondsToAdd = bookUnits * 5 * 3600;

  if (secondsToAdd > 0) {
    await redis.incrby("heran:total_seconds", secondsToAdd);
  }

  await redis.set(processedKey, "1");

  return res.status(200).json({ ok: true, bookUnits, secondsToAdd });
}
