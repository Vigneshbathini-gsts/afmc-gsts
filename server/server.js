
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");


// Load env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const db = require("./config/db");


app.get("/", (req, res) =>
  res.json({ status: "Server is running " })
);

// Routes

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);
const priceRoutes = require("./routes/priceRoutes");
app.use("/api/price", priceRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(` Server listening on port ${PORT}`)
);