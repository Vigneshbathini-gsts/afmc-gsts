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
const cocktailRoutes = require("./routes/cocktailRoutes");
const userRoutes = require("./routes/userRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/cocktails", cocktailRoutes);
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
