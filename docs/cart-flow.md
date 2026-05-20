# Cart Flow (Cart → Confirm Order → Payment → Invoice)

This document maps the end-to-end **Cart flow** across frontend and backend so the team can quickly find where to enhance or debug.

## User Journey (High level)

1. Add/update items in cart
2. Proceed to buy (creates/initializes `orderNumber`)
3. Confirm order
4. Complete payment (captures `paymentMode`, `paymentReference`, `paymentStatus`)
5. View invoice / invoice report

## Frontend (React) – main pages

### Routes

- `afmc-gsts/client/src/routes/AppRoutes.jsx`
  - Attendant: `/attendant/cart`, `/attendant/cart/buy`, `/attendant/confirm-order`, `/attendant/payment`, `/attendant/invoice`
  - User: `/user/cart`, `/user/cart/buy`, `/user/confirm-order`, `/user/payment`, `/user/invoice`
  - Common (used by both): `/attendant/invoice/:id`, `/attendant/payment/:id`, `/user/invoice/:id`, `/user/payment/:id`

### Cart + checkout pages

- `afmc-gsts/client/src/pages/common/CartPage.jsx` (core cart UI/logic used by both roles)
- `afmc-gsts/client/src/pages/common/CartBuy.jsx` (bridge page for `/cart/buy`)
- `afmc-gsts/client/src/pages/attendant/Cart.jsx` (wrapper → `CartPage`)
- `afmc-gsts/client/src/pages/user/Cart.jsx` (wrapper → `CartPage`)

### Confirm order

- `afmc-gsts/client/src/pages/attendant/ConfirmOrder.jsx`
- `afmc-gsts/client/src/pages/user/ConfirmOrder.jsx`
- `afmc-gsts/client/src/pages/attendant/ConfirmOrderpage.jsx` (extra confirm-order route used in app routes)

### Payment + invoice

- `afmc-gsts/client/src/pages/common/PaymentPage.jsx`
- `afmc-gsts/client/src/pages/common/InvoicePage.jsx`
- `afmc-gsts/client/src/pages/common/InvoiceReport.jsx`
- `afmc-gsts/client/src/pages/attendant/Payment.jsx`
- `afmc-gsts/client/src/pages/user/Payment.jsx`
- `afmc-gsts/client/src/pages/attendant/Invoice.jsx`
- `afmc-gsts/client/src/pages/user/Invoice.jsx`
- `afmc-gsts/client/src/pages/attendant/InvoiceReport.jsx`
- `afmc-gsts/client/src/pages/user/InvoiceReport.jsx`

## Frontend – API/service layer

- `afmc-gsts/client/src/services/api.js`
  - `cartAPI.proceedToBuy` → `POST /cart/proceed-to-buy`
  - `cartAPI.confirmOrder` → `POST /cart/confirm-order`
  - `invoiceAPI.getByOrderNumber` → `GET /invoice/:orderNumber`
  - `invoiceAPI.savePayment` → `POST /invoice/:orderNumber/payment`
- `afmc-gsts/client/src/services/orderService.js`
- `afmc-gsts/client/src/services/Invoiceservice.js`
- `afmc-gsts/client/src/services/InvoiceReportservice.js`
- `afmc-gsts/client/src/services/ConfirmOrderservice.js` (separate confirm-order service usage in some screens)

## Backend (Node/Express) – routes/controllers/models

### Server mount points

- `afmc-gsts/server/server.js`
  - mounts: `/api/cart`, `/api/payment`, `/api/invoice`, `/api/invoice-report`

### Cart

- `afmc-gsts/server/routes/cartRoutes.js`
- `afmc-gsts/server/controllers/cartController.js`
- `afmc-gsts/server/models/cartModel.js`

Key endpoints (see `afmc-gsts/server/routes/cartRoutes.js`):
- `POST /cart/proceed-to-buy`
- `POST /cart/confirm-order`
- plus cart CRUD: `GET /cart`, `POST /cart/add`, `PATCH /cart/:cartId`, `DELETE /cart/:cartId`, etc.

### Confirm order (separate module)

- `afmc-gsts/server/routes/ConfirmOrderroutes.js`
- `afmc-gsts/server/controllers/ConfirmOrdercontroller.js`
- `afmc-gsts/server/services/ConfirmOrderservices.js`
- `afmc-gsts/server/models/ConfirmOrdermodel.js`

### Payment

- `afmc-gsts/server/routes/paymentRoutes.js`
- `afmc-gsts/server/controllers/paymentController.js`
- `afmc-gsts/server/services/paymentService.js`
- `afmc-gsts/server/middleware/validatePayment.js` (validates payment reference for IMMEDIATE mode)

### Invoice

- `afmc-gsts/server/routes/invoiceRoutes.js`
- `afmc-gsts/server/controllers/invoiceController.js`
- `afmc-gsts/server/services/invoiceService.js`
- `afmc-gsts/server/models/invoiceModel.js`

### Invoice report

- `afmc-gsts/server/routes/InvoiceReportroute.js`
- `afmc-gsts/server/controllers/InvoiceReportcontroller.js`
- `afmc-gsts/server/services/InvoiceReportservice.js`
- `afmc-gsts/server/models/InvoiceReportmodel.js`

