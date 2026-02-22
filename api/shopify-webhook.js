import crypto from "crypto";
import { Redis } from "@upstash/redis";

export const config = { api: { bodyParser: true } };

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  // Comparación segura
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(hmacHeader || "")
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send("Missing SHOPIFY_WEBHOOK_SECRET");

  const hmac = req.headers["x-shopify-hmac-sha256"];
  const raw = JSON.stringify(req.body);

  if (!verifyShopifyHmac(raw, hmac, secret)) {
    return res.status(401).send("Invalid HMAC");
  }

  const order = req.body;
  const orderId = String(order.id);

  // Idempotencia: si Shopify reintenta, no duplicamos
  const processedKey = `heran:processed_order:${orderId}`;
  const already = await redis.get(processedKey);
  if (already) return res.status(200).json({ ok: true, skipped: true });

  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

  const bookUnits = lineItems.reduce((sum, item) => {
    const title = String(item?.title || "").toLowerCase();
    const qty = Number(item?.quantity || 0);
    return title.includes("book") ? sum + qty : sum;
  }, 0);

  const secondsToAdd = bookUnits * 5 * 3600;

  if (secondsToAdd > 0) {
    await redis.incrby("heran:total_seconds", secondsToAdd);
  }

  // Marca pedido como procesado (para siempre)
  await redis.set(processedKey, "1");

  return res.status(200).json({ ok: true, bookUnits, secondsToAdd });
}
