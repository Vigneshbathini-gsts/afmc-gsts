const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const session = require("express-session");
const MySQLSession = require("express-mysql-session");
const upload = require("./utils/uploadMiddleware");

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
app.use(express.json());
app.use("/uploads", express.static(upload.uploadPath));
app.use(`${BASE_PATH}/uploads`, express.static(upload.uploadPath));

app.get("/", (req, res) => {
  res.json({ status: "Server is running", basePath: BASE_PATH, apiBasePath: API_BASE_PATH });
});
app.get(BASE_PATH, (req, res) => {
  res.json({ status: "Server is running", basePath: BASE_PATH, apiBasePath: API_BASE_PATH });
});

const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");
const cocktailRoutes = require("./routes/cocktailRoutes");
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const KitchenOrdersRoutes = require("./routes/KitchenOrdersRoutes");
const collectionRoutes = require("./routes/collectionRoutes");
const priceRoutes = require("./routes/priceRoutes");
const offerRoutes = require("./routes/offerRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const profitRoutes = require("./routes/profitRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const cancelledOrdersRoutes = require("./routes/cancelledOrdersRoutes");
const menuRoutesbeer = require("./routes/MenuRoutesbeer");

const apiPrefixes = ["/api", API_BASE_PATH];
for (const prefix of apiPrefixes) {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/reports`, reportRoutes);
  app.use(`${prefix}/cocktails`, cocktailRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/orders`, orderRoutes);
  app.use(`${prefix}/bar-orders`, KitchenOrdersRoutes);
  app.use(`${prefix}/collection`, collectionRoutes);
  app.use(`${prefix}/price`, priceRoutes);
  app.use(`${prefix}/offers`, offerRoutes);
  app.use(`${prefix}/inventory`, inventoryRoutes);
  app.use(`${prefix}/profit`, profitRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/cancelled-orders`, cancelledOrdersRoutes);
  // End-user + attendant menu endpoints (e.g. GET {API_BASE_URL}/menubar)
  app.use(prefix, menuRoutesbeer);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
