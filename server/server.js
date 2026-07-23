const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const session = require("express-session");
const MySQLSession = require("express-mysql-session");
const timeout = require("connect-timeout");
const upload = require("./utils/uploadMiddleware");
const { createNetworkGuardMiddleware, isNetworkError, buildRetryableErrorResponse } = require("./utils/asyncHandler");

dotenv.config();

const app = express();
const BASE_PATH = `/${(process.env.BASE_PATH || "AFMCMESS").replace(
  /^\/+|\/+$/g,
  ""
)}`;
const API_BASE_PATH = `${BASE_PATH}/api`;

require("./config/db");

const MySQLStore = MySQLSession(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000, // 15 min
  expiration: 24 * 60 * 60 * 1000, // 24 hours
  createDatabaseTable: true,
  schema: {
    tableName: process.env.SESSION_TABLE_NAME || "sessions",
    columnNames: {
      session_id: "session_id",
      expires: "expires",
      data: "data",
    },
  },
});

app.use(
  session({
    store: sessionStore,
    name: process.env.SESSION_COOKIE_NAME || "afmc.sid",
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(
  cors({
    origin: (() => {
      const defaults = ["http://localhost:3000", "http://localhost:5173"];
      const raw = process.env.CORS_ORIGIN;
      if (!raw) return defaults;

      const configured = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const merged = [...configured];
      for (const origin of defaults) {
        if (!merged.includes(origin)) merged.push(origin);
      }
      return merged;
    })(),
    credentials: true,
  })
);

const REQUEST_TIMEOUT_SECONDS = Number(process.env.REQUEST_TIMEOUT_SECONDS || 10);

//Global Gateway Request Timeouts
app.use(timeout(`${REQUEST_TIMEOUT_SECONDS}s`));
app.use(express.json());
app.use(createNetworkGuardMiddleware());

// Timeout Halt Validator Middleware
const haltOnTimeout = (req, res, next) => {
  if (req.timedout) {
    if (!res.headersSent) {
      return res.status(503).json({
        success: false,
        message: "The request took too long. Please retry.",
        code: "GATEWAY_TIMEOUT",
      });
    }
    return;
  }

  next();
};

app.use("/uploads", express.static(upload.uploadPath));
app.use(`${BASE_PATH}/uploads`, express.static(upload.uploadPath));

app.get("/", haltOnTimeout, (req, res) => {
  res.json({ status: "Server is running", basePath: BASE_PATH, apiBasePath: API_BASE_PATH });
});
app.get(BASE_PATH, haltOnTimeout, (req, res) => {
  res.json({ status: "Server is running", basePath: BASE_PATH, apiBasePath: API_BASE_PATH });
});

const authRoutes = require("./src/features/auth/auth.routes");
const reportRoutes = require("./src/features/reports/report.routes");
const cocktailRoutes = require("./src/features/cocktails/cocktail.routes");
const userRoutes = require("./src/features/users/user.routes");
const orderRoutes = require("./src/features/orders/order.routes");
const outletOrderRoutes = require("./src/features/outletOrders/outletOrder.routes");
const collectionRoutes = require("./src/features/collection/collection.routes");
const priceRoutes = require("./src/features/pricing/price.routes");
const offerRoutes = require("./src/features/offers/offer.routes");
const inventoryRoutes = require("./src/features/inventory/inventory.routes");
const cartRoutes = require("./src/features/cart/cart.routes");
const profitRoutes = require("./src/features/pricing/profit.routes");
const notificationRoutes = require("./src/features/notifications/notification.routes");
const cancelledOrdersRoutes = require("./src/features/cancelledOrders/cancelledOrder.routes");
const menuRoutesbeer = require("./routes/MenuRoutesbeer");
const Pubmenubuyroutes = require("./modules/pubmenubuy/Pubmenubuyroutes");
const ConfirmOrderroutes = require("./routes/ConfirmOrderroutes");
const menuRoutes = require("./src/features/menu/menu.routes");
const buyOrderRoutes = require("./src/features/buyOrders/buyOrder.routes");
const confirmedOrderRoutes = require("./src/features/confirmedOrders/confirmedOrder.routes");
const invoiceRoutes = require("./src/features/invoices/invoice.routes");
const InvoiceReportroute = require("./src/features/invoices/invoiceReport.routes");
const orderHistoryRoutes = require("./routes/orderHistoryRoutes");
const paymentRoutes = require("./src/features/payments/payment.routes");
const orderEvents = require("./utils/orderEvents");
const barStatusRoutes = require("./src/features/barStatus/barStatus.routes");

const apiPrefixes = ["/api", API_BASE_PATH];
for (const prefix of apiPrefixes) {
  // Attached haltOnTimeout guard specifically before custom app business endpoints
  app.use(`${prefix}/auth`, haltOnTimeout, authRoutes);
  app.use(`${prefix}/reports`, haltOnTimeout, reportRoutes);
  app.use(`${prefix}/cocktails`, haltOnTimeout, cocktailRoutes);
  app.use(`${prefix}/users`, haltOnTimeout, userRoutes);
  app.use(`${prefix}/orders`, haltOnTimeout, orderRoutes);
  app.use(`${prefix}/bar-orders`, haltOnTimeout, outletOrderRoutes);
  app.use(`${prefix}/collection`, haltOnTimeout, collectionRoutes);
  app.use(`${prefix}/price`, haltOnTimeout, priceRoutes);
  app.use(`${prefix}/offers`, haltOnTimeout, offerRoutes);
  app.use(`${prefix}/inventory`, haltOnTimeout, inventoryRoutes);
  app.use(`${prefix}/cart`, haltOnTimeout, cartRoutes);
  app.use(`${prefix}/profit`, haltOnTimeout, profitRoutes);
  app.use(`${prefix}/notifications`, haltOnTimeout, notificationRoutes);
  app.use(`${prefix}/cancelled-orders`, haltOnTimeout, cancelledOrdersRoutes);
  app.use(`${prefix}/menu`, haltOnTimeout, menuRoutes);
  app.use(`${prefix}/buy-orders`, haltOnTimeout, buyOrderRoutes);
  app.use(`${prefix}/confirmed-orders`, haltOnTimeout, confirmedOrderRoutes);
  
  app.use(prefix, haltOnTimeout, menuRoutesbeer);
  app.use(prefix, haltOnTimeout, Pubmenubuyroutes);
  app.use(prefix, haltOnTimeout, ConfirmOrderroutes);
  app.use(`${prefix}/invoice`, haltOnTimeout, invoiceRoutes);
  app.use(`${prefix}/invoice-report`, haltOnTimeout, InvoiceReportroute);
  app.use(`${prefix}/order-history`, haltOnTimeout, orderHistoryRoutes);
  app.use(`${prefix}/payment`, haltOnTimeout, paymentRoutes);
  app.get(`${prefix}/order-events`, orderEvents.authenticateEventRequest, orderEvents.subscribe);
  app.use(`${prefix}/bar-status`, haltOnTimeout, barStatusRoutes);
}

// Global Custom Error Middleware (Catches timeout exceptions and file rules)
app.use((err, req, res, next) => {
  if (req.timedout || err?.timeout || err?.code === "ETIMEDOUT") {
    return res.status(503).json({
      success: false,
      message: "The request took too long. Please retry.",
      code: "GATEWAY_TIMEOUT",
    });
  }

  if (isNetworkError(err)) {
    return res.status(503).json(buildRetryableErrorResponse(err));
  }

  if (!err) return next();

  const message = err.code === "LIMIT_FILE_SIZE"
    ? "Image size must be 2MB or less."
    : err.message || "Upload failed.";

  res.status(400).json({ success: false, message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
