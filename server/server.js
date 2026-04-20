const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const session = require("express-session");
const MySQLSession = require("express-mysql-session");

dotenv.config();

const app = express();
const BASE_PATH = `/${(process.env.BASE_PATH || "AFMCMESS").replace(/^\/+|\/+$/g, "")}`;
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
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
      : ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(`${BASE_PATH}/uploads`, express.static(path.join(__dirname, "uploads")));

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


const Snacksveg = require("./routes/MenuRoutesbeer");
app.use(API_BASE_PATH, Snacksveg);

const Stacknonveg = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, Stacknonveg);

const Drinkhardbeer = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, Drinkhardbeer);

const Drinkhardbrandy = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, Drinkhardbrandy);

const Drinkhardbreezer = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, Drinkhardbreezer);

const Drinkhardvodka = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, Drinkhardvodka);

const DrinkhardGin = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, DrinkhardGin);

const DrinkhardRum = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, DrinkhardRum);


const DrinkhardWhisky = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, DrinkhardWhisky);

const DrinkhardWine = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, DrinkhardWine);


const DrinkhardLiquor = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, DrinkhardLiquor);

const DrinkhardTequila = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, DrinkhardTequila);

const DrinkhardCocktail = require('./routes/MenuRoutesbeer');
app.use(API_BASE_PATH, DrinkhardCocktail);


const menuroutesbeer = require('./routes/MenuRoutesbeer');
const Mocktailuser = require('./routes/MenuRoutesbeer')
app.use(API_BASE_PATH, Mocktailuser);
app.use(API_BASE_PATH, menuroutesbeer);







app.use(`${API_BASE_PATH}/auth`, authRoutes);
app.use(`${API_BASE_PATH}/reports`, reportRoutes);
app.use(`${API_BASE_PATH}/cocktails`, cocktailRoutes);
app.use(`${API_BASE_PATH}/users`, userRoutes);
app.use(`${API_BASE_PATH}/orders`, orderRoutes);
app.use(`${API_BASE_PATH}/bar-orders`, KitchenOrdersRoutes);
app.use(`${API_BASE_PATH}/collection`, collectionRoutes);
app.use(`${API_BASE_PATH}/price`, priceRoutes);
app.use(`${API_BASE_PATH}/offers`, offerRoutes);
app.use(`${API_BASE_PATH}/inventory`, inventoryRoutes);
app.use(`${API_BASE_PATH}/profit`, profitRoutes);
app.use(`${API_BASE_PATH}/notifications`, notificationRoutes);
app.use(`${API_BASE_PATH}/cancelled-orders`, cancelledOrdersRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
