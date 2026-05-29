const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "secretkey";
const clients = new Set();

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

  req.on("close", () => {
    clients.delete(client);
  });
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
  emitOrderConfirmed,
  subscribe,
};
