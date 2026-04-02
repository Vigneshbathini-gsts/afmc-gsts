import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "../pages/common/Home";
import NotFound from "../pages/common/NotFound";
import Login from "../pages/auth/Login";
import ChangePassword from "../pages/auth/ChangePassword";
import Unauthorized from "../pages/auth/Unauthorized";
import ForgotPassword from "../pages/auth/ForgotPassword";

import AdminDashboard from "../pages/admin/Dashboard";
import Inventory from "../pages/admin/Inventory";
import AddItem from "../pages/admin/AddItem";
import EditItem from "../pages/admin/EditItem";
import Reports from "../pages/admin/Reports";
import UserManagement from "../pages/admin/UserManagement";
import Offers from "../pages/admin/Offers";
import PriceUpdate from "../pages/admin/PriceUpdate";
import ProfitManagement from "../pages/admin/ProfitManagement";
import CocktailManagement from "../pages/admin/CocktailManagement";
import AdminOrderHistory from "../pages/admin/OrderHistory";

import AttendantDashboard from "../pages/attendant/Dashboard";
import RegisterMember from "../pages/attendant/RegisterMember";
import AttendantCart from "../pages/attendant/Cart";
import AttendantConfirmOrder from "../pages/attendant/ConfirmOrder";
import AttendantPayment from "../pages/attendant/Payment";
import AttendantInvoice from "../pages/attendant/Invoice";
import AttendantOrderHistory from "../pages/attendant/OrderHistory";

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

import KitchenOrders from "../pages/kitchen/Orders";
import KitchenPrepareOrder from "../pages/kitchen/PrepareOrder";
import KitchenOrderHistory from "../pages/kitchen/OrderHistory";

import BarOrders from "../pages/bar/Orders";
import BarPrepareOrder from "../pages/bar/PrepareOrder";

import StorekeeperDashboard from "../pages/storekeeper/Dashboard";
import StorekeeperInventory from "../pages/storekeeper/Inventory";
import StorekeeperAddItem from "../pages/storekeeper/AddItem";
import StorekeeperEditItem from "../pages/storekeeper/EditItem";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />



        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/inventory" element={<Inventory />} />
        <Route path="/admin/add-item" element={<AddItem />} />
        <Route path="/admin/edit-item" element={<EditItem />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/offers" element={<Offers />} />
        <Route path="/admin/price-update" element={<PriceUpdate />} />
        <Route path="/admin/profit-management" element={<ProfitManagement />} />
        <Route path="/admin/cocktail-management" element={<CocktailManagement />} />
        <Route path="/admin/order-history" element={<AdminOrderHistory />} />

        <Route path="/attendant/dashboard" element={<AttendantDashboard />} />
        <Route path="/attendant/register-member" element={<RegisterMember />} />
        <Route path="/attendant/cart" element={<AttendantCart />} />
        <Route path="/attendant/confirm-order" element={<AttendantConfirmOrder />} />
        <Route path="/attendant/payment" element={<AttendantPayment />} />
        <Route path="/attendant/invoice" element={<AttendantInvoice />} />
        <Route path="/attendant/order-history" element={<AttendantOrderHistory />} />

        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="/user/snacks" element={<Snacks />} />
        <Route path="/user/drinks" element={<Drinks />} />
        <Route path="/user/item/:id" element={<ItemDetails />} />
        <Route path="/user/cart" element={<UserCart />} />
        <Route path="/user/confirm-order" element={<UserConfirmOrder />} />
        <Route path="/user/payment" element={<UserPayment />} />
        <Route path="/user/invoice" element={<UserInvoice />} />
        <Route path="/user/active-orders" element={<ActiveOrders />} />
        <Route path="/user/order-history" element={<UserOrderHistory />} />

        <Route path="/kitchen/orders" element={<KitchenOrders />} />
        <Route path="/kitchen/prepare-order" element={<KitchenPrepareOrder />} />
        <Route path="/kitchen/order-history" element={<KitchenOrderHistory />} />

        <Route path="/bar/orders" element={<BarOrders />} />
        <Route path="/bar/prepare-order" element={<BarPrepareOrder />} />

        <Route path="/storekeeper/dashboard" element={<StorekeeperDashboard />} />
        <Route path="/storekeeper/inventory" element={<StorekeeperInventory />} />
        <Route path="/storekeeper/add-item" element={<StorekeeperAddItem />} />
        <Route path="/storekeeper/edit-item" element={<StorekeeperEditItem />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
