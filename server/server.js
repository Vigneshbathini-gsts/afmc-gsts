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

app.use("/api/auth", authRoutes);
const priceRoutes = require("./routes/priceRoutes");
app.use("/api/price", priceRoutes);

const offerRoutes = require("./routes/offerRoutes");
app.use("/api/offers", offerRoutes);

const inventoryRoutes = require("./routes/inventoryRoutes");
app.use("/api/inventory", inventoryRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server listening on port ${PORT}`)
);
