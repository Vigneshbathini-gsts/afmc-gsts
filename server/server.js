const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

require("./config/db");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ status: "Server is running" });
});

const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
const priceRoutes = require("./routes/priceRoutes");
app.use("/api/price", priceRoutes);

const offerRoutes = require("./routes/offerRoutes");
app.use("/api/offers", offerRoutes);

const inventoryRoutes = require("./routes/inventoryRoutes");
app.use("/api/inventory", inventoryRoutes);

const profitRoutes = require("./routes/profitRoutes");
app.use("/api/profit", profitRoutes);

const notificationRoutes = require("./routes/notificationRoutes");
app.use("/api/notifications", notificationRoutes);

const cancelledOrdersRoutes = require("./routes/cancelledOrdersRoutes");
app.use("/api/cancelled-orders", cancelledOrdersRoutes);

const orderRoutes = require("./routes/orderRoutes");
app.use("/api/orders", orderRoutes);

const barOrdersRoutes = require("./routes/barOrdersRoutes");
app.use("/api/bar-orders", barOrdersRoutes);

const collectionRoutes = require("./routes/collectionRoutes");
app.use("/api/collection", collectionRoutes);

const cocktailRoutes = require("./routes/cocktailRoutes");
app.use("/api/cocktails", cocktailRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server listening on port ${PORT}`)
);
