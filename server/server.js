
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const db = require("./config/db");


app.get("/", (req, res) =>
  res.json({ status: "Server is running " })
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(` Server listening on port ${PORT}`)
);