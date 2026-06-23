const BarStatusService = require("../services/BarStatusService");

const clients = new Set();
const HEARTBEAT_MS = 25000;

function sendEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function subscribe(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const client = { res };
  clients.add(client);

  res.write(": connected\n\n");

  try {
    const status = await BarStatusService.getBarStatus();
    sendEvent(res, "bar-status", status);
  } catch {
    // Keep the stream open. The normal API fallback can still check status.
  }

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

function broadcastBarStatus(status) {
  const body = `event: bar-status\ndata: ${JSON.stringify(status)}\n\n`;

  for (const client of clients) {
    try {
      client.res.write(body);
    } catch {
      clients.delete(client);
    }
  }
}

module.exports = {
  broadcastBarStatus,
  subscribe,
};
