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
import AttendantCart from "../pages/attendant/Cart";
import AttendantConfirmOrder from "../pages/attendant/ConfirmOrder";
import AttendantPayment from "../pages/attendant/Payment";
import AttendantInvoice from "../pages/attendant/Invoice";
import AttendantActiveOrders from "../pages/attendant/ActiveOrders";
import AttendantOrderStatus from "../pages/attendant/OrderStatus";

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
import UserOrderStatus from "../pages/user/OrderStatus";
import MenuDashboard from "../components/common/MenuDashboard";
import EnduserOther from "../components/common/ENDUSERFLOW/EnduserOther";
import EnduserMocktail from "../components/common/ENDUSERFLOW/EnduserMocktail";
import Snackveg from "../components/common/ENDUSERFLOW/Snackveg";
import Snacknonveg from "../components/common/ENDUSERFLOW/Snacknonveg";
import Drinkharddrink from "../components/common/ENDUSERFLOW/Drinkharddrink";

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
          <ProtectedRoute allowedRoles={[10,80]}>
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
          <ProtectedRoute allowedRoles={[20]}>
            <AttendantLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AttendantDashboard />} />
        <Route path="menudash" element={<MenuDashboard />} />
        <Route path="register-member" element={<RegisterMember />} />
        <Route path="cart" element={<AttendantCart />} />
        <Route path="confirm-order" element={<AttendantConfirmOrder />} />
        <Route path="payment" element={<AttendantPayment />} />
        <Route path="invoice" element={<AttendantInvoice />} />
        <Route path="active-orders" element={<AttendantActiveOrders />} />
        <Route path="order-status" element={<AttendantOrderStatus />} />


         {/* --------------------------------------------------------------- */}
        <Route path="Enduserbar" element={<EnduserOther />} />
        <Route path="EnduserMocktail" element={<EnduserMocktail />} />
        <Route path="Snackveg" element={<Snackveg />} />
        <Route path="Snacknonveg" element={<Snacknonveg />} />
        <Route path="Drinkharddrink" element={<Drinkharddrink />} />

        {/* ----------------------------------------------------------------- */}
      </Route>

      {/* ================= USER ================= */}
      <Route
        path="/user"
        element={
          <ProtectedRoute allowedRoles={[30]}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="dashboard-Page" element={<UserDashboard />} />
        <Route path="menudash" element={<MenuDashboard />} />
        <Route path="snacks" element={<Snacks />} />
        <Route path="drinks" element={<Drinks />} />
        <Route path="item/:id" element={<ItemDetails />} />
        <Route path="cart" element={<UserCart />} />
        <Route path="confirm-order" element={<UserConfirmOrder />} />
        <Route path="payment" element={<UserPayment />} />
        <Route path="invoice" element={<UserInvoice />} />
        <Route path="active-orders" element={<ActiveOrders />} />
        <Route path="order-status" element={<UserOrderStatus />} />

       



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
          <ProtectedRoute allowedRoles={["STOREKEEPER", 50]}>
            <StorekeeperDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/storekeeper/inventory"
        element={
          <ProtectedRoute allowedRoles={["STOREKEEPER", 50]}>
            <StorekeeperInventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/storekeeper/add-item"
        element={
          <ProtectedRoute allowedRoles={["STOREKEEPER", 50]}>
            <StorekeeperAddItem />
          </ProtectedRoute>
        }
      />
      <Route
        path="/storekeeper/edit-item"
        element={
          <ProtectedRoute allowedRoles={["STOREKEEPER", 50]}>
            <StorekeeperEditItem />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
