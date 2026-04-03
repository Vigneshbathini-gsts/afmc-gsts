import React from "react";
import { Routes, Route } from "react-router-dom";

// Common Pages
import Home from "../pages/common/Home";
import NotFound from "../pages/common/NotFound";
import Login from "../pages/auth/Login";
import ChangePassword from "../pages/auth/ChangePassword";
import Unauthorized from "../pages/auth/Unauthorized";
import ForgotPassword from "../pages/auth/ForgotPassword";

// Layouts
import UserLayout from "../components/layouts/UserLayout";
import AttendantLayout from "../components/layouts/AttendantLayout";
import AdminLayout from "../components/layouts/AdminLayout";
import KitchenLayout from "../components/layouts/KitchenLayout";
// Admin Pages
import AdminDashboard from "../pages/admin/Dashboard";
import Inventory from "../pages/admin/Inventory";
import AddItem from "../pages/admin/AddItem";
import EditItem from "../pages/admin/EditItem";
import Reports from "../pages/admin/Reports";
import StockReports from "../pages/admin/StockReports";
import UserManagement from "../pages/admin/UserManagement";
import Offers from "../pages/admin/Offers";
import PriceUpdate from "../pages/admin/PriceUpdate";
import ProfitManagement from "../pages/admin/ProfitManagement";
import CocktailManagement from "../pages/admin/CocktailManagement";
import AdminOrderHistory from "../pages/admin/OrderHistory";
import CancelledOrders from "../pages/admin/CancelledOrders";

// Attendant Pages
import AttendantDashboard from "../pages/attendant/Dashboard";
import RegisterMember from "../pages/attendant/RegisterMember";
import AttendantCart from "../pages/attendant/Cart";
import AttendantConfirmOrder from "../pages/attendant/ConfirmOrder";
import AttendantPayment from "../pages/attendant/Payment";
import AttendantInvoice from "../pages/attendant/Invoice";
import AttendantOrderHistory from "../pages/attendant/OrderHistory";

// User Pages
import UserDashboard from "../pages/user/Dashboard";
import Snacks from "../pages/user/Snacks";
import Drinks from "../pages/user/Drinks";
import ItemDetails from "../pages/user/ItemDetails";
import UserCart from "../pages/user/Cart";
import UserConfirmOrder from "../pages/user/ConfirmOrder";
import UserPayment from "../pages/user/Payment";
import UserInvoice from "../pages/user/Invoice";
import ActiveOrders from "../pages/user/ActiveOrders";
import UserOrderHistory from "../pages/user/OrderHistory";

// Kitchen Pages





import OutletDashboard from "../pages/kitchen/outlet/dashboard";
import OutletOrderHistory from "../pages/kitchen/outlet/OrderHistory";
import OutletOrders from "../pages/kitchen/outlet/Orders";
import OutletPrepareOrder from "../pages/kitchen/outlet/PrepareOrder";


// Optional for now (later if needed)
// import BarLayout from "../layouts/BarLayout";
// import StorekeeperLayout from "../layouts/StorekeeperLayout";



// Storekeeper Pages
import StorekeeperDashboard from "../pages/storekeeper/Dashboard";
import StorekeeperInventory from "../pages/storekeeper/Inventory";
import StorekeeperAddItem from "../pages/storekeeper/AddItem";
import StorekeeperEditItem from "../pages/storekeeper/EditItem";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* ================= ADMIN ================= */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="add-item" element={<AddItem />} />
        <Route path="edit-item" element={<EditItem />} />
        <Route path="reports" element={<Reports />} />
        <Route path="stock-reports" element={<StockReports />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="offers" element={<Offers />} />
        <Route path="price-update" element={<PriceUpdate />} />
        <Route path="profit-management" element={<ProfitManagement />} />
        <Route path="cocktail-management" element={<CocktailManagement />} />
        <Route path="order-history" element={<AdminOrderHistory />} />
        <Route path="cancelled-orders" element={<CancelledOrders />} />
      </Route>

      {/* ================= ATTENDANT ================= */}
      <Route path="/attendant" element={<AttendantLayout />}>
        <Route path="dashboard" element={<AttendantDashboard />} />
        <Route path="register-member" element={<RegisterMember />} />
        <Route path="cart" element={<AttendantCart />} />
        <Route path="confirm-order" element={<AttendantConfirmOrder />} />
        <Route path="payment" element={<AttendantPayment />} />
        <Route path="invoice" element={<AttendantInvoice />} />
        <Route path="order-history" element={<AttendantOrderHistory />} />
      </Route>

      {/* ================= USER ================= */}
      <Route path="/user" element={<UserLayout />}>
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="snacks" element={<Snacks />} />
        <Route path="drinks" element={<Drinks />} />
        <Route path="item/:id" element={<ItemDetails />} />
        <Route path="cart" element={<UserCart />} />
        <Route path="confirm-order" element={<UserConfirmOrder />} />
        <Route path="payment" element={<UserPayment />} />
        <Route path="invoice" element={<UserInvoice />} />
        <Route path="active-orders" element={<ActiveOrders />} />
        <Route path="order-history" element={<UserOrderHistory />} />
      </Route>

      {/* ================= OUTLETS ================= */}
      <Route path="/kitchen" element={<KitchenLayout />}>
        <Route path="dashboard" element={<OutletDashboard outletType="KITCHEN" />} />
        <Route path="orders" element={<OutletOrders outletType="KITCHEN" />} />
        <Route path="prepare-order/:id" element={<OutletPrepareOrder outletType="KITCHEN" />} />
        <Route path="order-history" element={<OutletOrderHistory outletType="KITCHEN" />} />
      </Route>

      <Route path="/bar" element={<KitchenLayout />}>
        <Route path="dashboard" element={<OutletDashboard outletType="BAR" />} />
        <Route path="orders" element={<OutletOrders outletType="BAR" />} />
        <Route path="prepare-order/:id" element={<OutletPrepareOrder outletType="BAR" />} />
        <Route path="order-history" element={<OutletOrderHistory outletType="BAR" />} />
      </Route>

      {/* ================= STOREKEEPER ================= */}
      <Route path="/storekeeper/dashboard" element={<StorekeeperDashboard />} />
      <Route path="/storekeeper/inventory" element={<StorekeeperInventory />} />
      <Route path="/storekeeper/add-item" element={<StorekeeperAddItem />} />
      <Route path="/storekeeper/edit-item" element={<StorekeeperEditItem />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
