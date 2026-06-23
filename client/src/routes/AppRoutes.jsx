import React from "react";
import { Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
// Common Pages
import Home from "../pages/common/Home";
import NotFound from "../pages/common/NotFound";
import Login from "../pages/auth/Login";
import ChangePassword from "../pages/auth/ChangePassword";
import Unauthorized from "../pages/auth/Unauthorized";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";

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
import TodayStockOutDetails from "../pages/admin/TodayStockOutDetails";
import UserManagement from "../pages/admin/UserManagement";
import UserEdit from "../pages/admin/UserEdit";
import Offers from "../pages/admin/Offers";
import PriceUpdate from "../pages/admin/PriceUpdate";
import ProfitManagement from "../pages/admin/ProfitManagement";
import CocktailManagement from "../pages/admin/CocktailManagement";
import CocktailCreate from "../pages/admin/CocktailCreate";
import CocktailEdit from "../pages/admin/CocktailEdit";
import AdminOrderHistory from "../pages/admin/OrderHistory";
import CancelledOrders from "../pages/admin/CancelledOrders";
import OfferCreate from "../pages/admin/OfferCreate";
import OfferEdit from "../pages/admin/OfferEdit";

// Attendant Pages
import AttendantDashboard from "../pages/attendant/Dashboard";
import RegisterMember from "../pages/attendant/RegisterMember";
import AttendantCart from "../flows/cart/role/attendant/Cart";
import AttendantConfirmOrder from "../flows/cart/role/attendant/ConfirmOrder";
import Buyflowconfirmorder from "../pages/attendant/Buyflowconfirmorder";
import AttendantPayment from "../flows/cart/role/attendant/Payment";
import ConfirmOrderpage from "../flows/cart/role/attendant/ConfirmOrderpage";
import AttendantInvoice from "../flows/cart/role/attendant/Invoice";
import AttendantBuyflowinvoicereport from "../pages/attendant/Buyflowinvoicereport";
import AttendantActiveOrders from "../pages/attendant/ActiveOrders";
import AttendantOrderStatus from "../pages/attendant/OrderStatus";
import Pubmenubuy from "../flows/buy/pages/Pubmenubuy";
import CartBuy from "../flows/cart/pages/CartBuy";

// User Pages
import UserDashboard from "../pages/user/Dashboard";
import Snacks from "../pages/user/Snacks";
import Drinks from "../pages/user/Drinks";
import ItemDetails from "../pages/user/ItemDetails";
import UserCart from "../flows/cart/role/user/Cart";
import UserConfirmOrder from "../flows/cart/role/user/ConfirmOrder";
import UserPayment from "../flows/cart/role/user/Payment";
import UserInvoice from "../flows/cart/role/user/Invoice";
import UserBuyflowinvoicereport from "../pages/user/Buyflowinvoicereport";
import UserInvoiceReport from "../flows/cart/role/user/InvoiceReport";
import ActiveOrders from "../pages/user/ActiveOrders";
import UserOrderStatus from "../pages/user/OrderStatus";
import MenuDashboard from "../components/common/MenuDashboard";
import EnduserOther from "../components/common/ENDUSERFLOW/EnduserOther";
import EnduserMocktail from "../components/common/ENDUSERFLOW/EnduserMocktail";
import Snackveg from "../components/common/ENDUSERFLOW/Snackveg";
import Snacknonveg from "../components/common/ENDUSERFLOW/Snacknonveg";
import Drinkharddrink from "../components/common/ENDUSERFLOW/Drinkharddrink";
import InvoicePage from "../flows/cart/pages/InvoicePage";
import OrderHistoryPage from "../pages/common/OrderHistoryPage";
import Payment from "../flows/cart/role/user/Payment";


// Kitchen Pages

import OutletDashboard from "../pages/kitchen/outlet/dashboard";
import KitchenCancelledOrder from "../pages/kitchen/KitchenCancelledOrder";
import KitchenOrderHistory from "../pages/kitchen/KitchenOrderHistory";




// Storekeeper Pages
import StorekeeperDashboard from "../pages/storekeeper/Dashboard";
import StorekeeperInventory from "../pages/storekeeper/Inventory";
import StorekeeperAddItem from "../pages/storekeeper/AddItem";
import StorekeeperEditItem from "../pages/storekeeper/EditItem";

import BarstockReports from "../pages/admin/StockReportspages/BarstockReports";
import Ordertransactiondetails from "../pages/admin/StockReportspages/Ordertransactiondetails";
import Orderitemdetails from "../pages/admin/StockReportspages/Orderitemdetails";
import OutletOrderDetails from "../pages/kitchen/OutletOrderDetails";

//Bar status
import BarClosed from "../pages/common/BarClosed";


export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />


      {/* ================= ADMIN ================= */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[10, 80]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowedRoles={[10, 80]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="inventory" element={<Inventory />} />
        <Route path="stock-reports" element={<Navigate to="barstock" replace />} />
        <Route path="stock-reports/barstock" element={<BarstockReports />} />
        <Route path="stock-reports/order-transaction" element={<Ordertransactiondetails />} />
        <Route path="stock-reports/order-item" element={<Orderitemdetails />} />
        <Route path="stock-in-out-report" element={<StockReports />} />
        <Route path="today-stock-out-details" element={<TodayStockOutDetails />} />
        <Route path="add-item" element={<AddItem />} />
        <Route path="edit-item" element={<EditItem />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="users/:id" element={<UserEdit />} />
        <Route path="offers" element={<Offers />} />
        <Route path="offers/create" element={<OfferCreate />} />
        <Route path="offers/edit/:id" element={<OfferEdit />} />


        <Route path="price-update" element={<PriceUpdate />} />
        <Route path="profit-management" element={<ProfitManagement />} />
        <Route path="cocktailmanag" element={<CocktailManagement />} />
        <Route path="cocktail-management" element={<CocktailManagement />} />
        <Route path="cocktail-create" element={<CocktailCreate />} />
        <Route path="cocktail-edit" element={<CocktailEdit />} />
        <Route path="order-history" element={<AdminOrderHistory />} />
        <Route path="cancelled-orders" element={<CancelledOrders />} />
      </Route>

      {/* ================= ATTENDANT ================= */}
      <Route
        path="/attendant"
        element={
          <ProtectedRoute allowedRoles={[30]} roleLoginTypeRules={{ 30: ["Member"] }}>
            <AttendantLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="register-member" replace />} />
        <Route path="dashboard" element={<AttendantDashboard />} />
        <Route path="menudash" element={<MenuDashboard />} />
        <Route path="menudash/buy" element={<Pubmenubuy />} />
        <Route path="register-member" element={<RegisterMember />} />
        <Route path="item/:id" element={<ItemDetails />} />
        <Route path="cart" element={<AttendantCart />} />
        <Route path="cart/buy" element={<CartBuy />} />
        <Route path="confirm-order" element={<AttendantConfirmOrder />} />
        <Route path="Buyflowconfirmorder" element={<Buyflowconfirmorder />} />
        <Route path="confirm-order-page" element={<ConfirmOrderpage />} />
        <Route path="payment" element={<AttendantPayment />} />
        <Route path="invoice" element={<AttendantInvoice />} />
        <Route path="invoice-report" element={<UserInvoiceReport />} />
        <Route path="Buyflowinvoicereport" element={<AttendantBuyflowinvoicereport />} />
        <Route path="active-orders" element={<AttendantActiveOrders />} />
        <Route path="order-status" element={<AttendantOrderStatus />} />
        <Route path="invoice/:id" element={<InvoicePage />} />
        <Route path="payment/:id" element={<Payment />} />

      </Route>

      {/* ================= USER ================= */}
      <Route
        path="/user"
        element={
          <ProtectedRoute allowedRoles={[20, 30]} roleLoginTypeRules={{ 30: ["Non Member"] }}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="dashboard-Page" element={<UserDashboard />} />
        <Route path="menudash" element={<MenuDashboard />} />
        <Route path="menudash/buy" element={<Pubmenubuy />} />
       
        <Route path="snacks" element={<Snacks />} />
        <Route path="drinks" element={<Drinks />} />
        <Route path="item/:id" element={<ItemDetails />} />
        <Route path="cart" element={<UserCart />} />
        <Route path="cart/buy" element={<CartBuy />} />
        <Route path="confirm-order" element={<UserConfirmOrder />} />
        <Route path="Buyflowconfirmorder" element={<Buyflowconfirmorder />} />
        <Route path="confirm-order-page" element={<ConfirmOrderpage />} />
        <Route path="payment" element={<UserPayment />} />
        <Route path="invoice" element={<UserInvoice />} />
        <Route path="Buyflowinvoicereport" element={<UserBuyflowinvoicereport />} />
        <Route path="invoice-report" element={<UserInvoiceReport />} />
        <Route path="active-orders" element={<ActiveOrders />} />
        <Route path="order-status" element={<UserOrderStatus />} />

        {/* Enduser flow routes (moved from attendant; endusers are roleId 30) */}
        <Route path="Enduserbar" element={<EnduserOther />} />
        <Route path="EnduserMocktail" element={<EnduserMocktail />} />
        <Route path="Snackveg" element={<Snackveg />} />
        <Route path="Snacknonveg" element={<Snacknonveg />} />
        <Route path="Drinkharddrink" element={<Drinkharddrink />} />
        <Route path="invoice/:id" element={<InvoicePage />} />
        <Route path="payment/:id" element={<Payment />} />
        <Route path="order-history" element={<OrderHistoryPage />} />





      </Route>

      {/* ================= OUTLETS ================= */}
      <Route
        path="/kitchen"
        element={
          <ProtectedRoute allowedRoles={[40]} allowedOutletTypes={["KITCHEN"]}>
            <KitchenLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<OutletDashboard />} />
        <Route path="order-details" element={<OutletOrderDetails />} />
        {/* Add these missing routes */}
        <Route path="cancelled-orders" element={<KitchenCancelledOrder />} />
        <Route path="order-history" element={<KitchenOrderHistory />} />
      </Route>

      <Route
        path="/bar"
        element={
          <ProtectedRoute allowedRoles={[40]} allowedOutletTypes={["BAR"]}>
            <KitchenLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<OutletDashboard />} />
        <Route path="order-details" element={<OutletOrderDetails />} />
        <Route path="cancelled-orders" element={<KitchenCancelledOrder />} />
        <Route path="order-history" element={<KitchenOrderHistory />} />
      </Route>

      {/* ================= STOREKEEPER ================= */}
      <Route
        path="/storekeeper/dashboard"
        element={
          <ProtectedRoute allowedRoles={[80, "STKP", "STOREKEEPER"]}>
            <StorekeeperDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/storekeeper/inventory"
        element={
          <ProtectedRoute allowedRoles={[80, "STKP", "STOREKEEPER"]}>
            <StorekeeperInventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/storekeeper/add-item"
        element={
          <ProtectedRoute allowedRoles={[80, "STKP", "STOREKEEPER"]}>
            <StorekeeperAddItem />
          </ProtectedRoute>
        }
      />
      <Route
        path="/storekeeper/edit-item"
        element={
          <ProtectedRoute allowedRoles={[80, "STKP", "STOREKEEPER"]}>
            <StorekeeperEditItem />
          </ProtectedRoute>
        }
      />

      <Route path="/bar-closed" element={<BarClosed />}/>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
