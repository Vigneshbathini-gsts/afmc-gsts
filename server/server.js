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
const orderRoutes = require("./routes/orderRoutes");
const menuroutesbeer = require('./routes/MenuRoutesbeer');
const Mocktailuser = require('./routes/MenuRoutesbeer')
app.use("/api", Mocktailuser);
app.use("/api", menuroutesbeer);

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/cocktails", cocktailRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
const priceRoutes = require("./routes/priceRoutes");
app.use("/api/price", priceRoutes);

const offerRoutes = require("./routes/offerRoutes");
app.use("/api/offers", offerRoutes);


const Snacksveg = require("./routes/MenuRoutesbeer");
app.use("/api", Snacksveg);

const inventoryRoutes = require("./routes/inventoryRoutes");
app.use("/api/inventory", inventoryRoutes);

const profitRoutes = require("./routes/profitRoutes");
app.use("/api/profit", profitRoutes);

const notificationRoutes = require("./routes/notificationRoutes");
app.use("/api/notifications", notificationRoutes);

const cancelledOrdersRoutes = require("./routes/cancelledOrdersRoutes");
app.use("/api/cancelled-orders", cancelledOrdersRoutes);

const Stacknonveg = require('./routes/MenuRoutesbeer');
app.use('/api', Stacknonveg);

const Drinkhardbeer = require('./routes/MenuRoutesbeer');
app.use('/api', Drinkhardbeer);

const Drinkhardbrandy = require('./routes/MenuRoutesbeer');
app.use('/api', Drinkhardbrandy);

const Drinkhardbreezer = require('./routes/MenuRoutesbeer');
app.use('/api', Drinkhardbreezer);

const Drinkhardvodka = require('./routes/MenuRoutesbeer');
app.use('/api', Drinkhardvodka);

const DrinkhardGin = require('./routes/MenuRoutesbeer');
app.use('/api', DrinkhardGin);

const DrinkhardRum = require('./routes/MenuRoutesbeer');
app.use('/api', DrinkhardRum);


const DrinkhardWhisky = require('./routes/MenuRoutesbeer');
app.use('/api', DrinkhardWhisky);

const DrinkhardWine = require('./routes/MenuRoutesbeer');
app.use('/api', DrinkhardWine);


const DrinkhardLiquor = require('./routes/MenuRoutesbeer');
app.use('/api', DrinkhardLiquor);

const DrinkhardTequila = require('./routes/MenuRoutesbeer');
app.use('/api', DrinkhardTequila);

const DrinkhardCocktail = require('./routes/MenuRoutesbeer');
app.use('/api', DrinkhardCocktail);






const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server listening on port ${PORT}`)
);
