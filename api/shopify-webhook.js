let totalSeconds = 0;
let processedOrders = new Set();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const order = req.body;
  const orderId = String(order.id);

  if (processedOrders.has(orderId)) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const lineItems = order.line_items || [];

  const bookUnits = lineItems.reduce((sum, item) => {
    const title = (item.title || "").toLowerCase();
    const qty = Number(item.quantity || 0);
    if (title.includes("book")) return sum + qty;
    return sum;
  }, 0);

  totalSeconds += bookUnits * 5 * 3600;
  processedOrders.add(orderId);

  return res.status(200).json({ ok: true, bookUnits, totalSeconds });
}
