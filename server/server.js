const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const session = require("express-session");
const MySQLSession = require("express-mysql-session");

dotenv.config();

const app = express();

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

// Session middleware (MySQL-backed)
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
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ status: "Server is running" });
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

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/cocktails", cocktailRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/bar-orders", KitchenOrdersRoutes);
app.use("/api/collection", collectionRoutes);
app.use("/api/price", priceRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/profit", profitRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/cancelled-orders", cancelledOrdersRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
