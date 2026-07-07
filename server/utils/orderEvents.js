const jwt = require("jsonwebtoken");
const ConfirmOrdermodel = require("../models/ConfirmOrdermodel");

const JWT_SECRET = process.env.JWT_SECRET || "secretkey";
const clients = new Set();
const HEARTBEAT_MS = 25000;

function authenticateEventRequest(req, res, next) {
  const header = req.headers.authorization;
  const tokenFromHeader = header && header.startsWith("Bearer ") ? header.split(" ")[1] : "";
  const token = tokenFromHeader || req.query.token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function subscribe(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  const client = { res };
  clients.add(client);

  const heartbeatId = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeatId);
      clients.delete(client);
    }
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeatId);
    clients.delete(client);
  });
}

function buildOrderStatusUpdatePayload({ orderNumber, status, payment_status, paymentStatus }) {
  return {
    orderNumber: String(orderNumber ?? ""),
    status: String(status || "Received"),
    payment_status: String(payment_status || paymentStatus || "Not Paid"),
  };
}

async function emitOrderStatusUpdate(orderNumber, overrides = {}) {
  const normalizedOrderNumber = String(orderNumber ?? "").trim();
  if (!normalizedOrderNumber) {
    return;
  }

  let snapshot = {};
  try {
    const data = await ConfirmOrdermodel.getConfirmedOrderDetails(normalizedOrderNumber);
    snapshot = {
      status: data?.header?.status,
      payment_status: data?.header?.payment_status,
    };
  } catch (error) {
    console.error("Unable to resolve order status snapshot:", error);
  }

  const payload = buildOrderStatusUpdatePayload({
    orderNumber: normalizedOrderNumber,
    ...snapshot,
    ...overrides,
  });
  const body = `event: order-status-updated\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    try {
      client.res.write(body);
    } catch {
      clients.delete(client);
    }
  }
}

function emitOrderConfirmed(payload) {
  const body = `event: order-confirmed\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    try {
      client.res.write(body);
    } catch {
      clients.delete(client);
    }
  }
}

module.exports = {
  authenticateEventRequest,
  buildOrderStatusUpdatePayload,
  emitOrderConfirmed,
  emitOrderStatusUpdate,
  subscribe,
};
