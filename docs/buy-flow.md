# Buy Flow (Menu Buy / Cart Buy → Order Summary → Payment → Invoice)

This document maps the **Buy flow** (the “Pub menu buy” order flow) across frontend and backend.

## User Journey (High level)

1. Start buy from Menu Dashboard (or from Cart “buy”)
2. Create/continue an order using `orderNumber`
3. Update quantities / delete items / cancel order
4. Proceed to payment
5. View invoice / invoice report

## Frontend (React) – main pages

### Routes

- `afmc-gsts/client/src/routes/AppRoutes.jsx`
  - Attendant/User: `/menudash/buy` and `/cart/buy`

### Buy pages

- `afmc-gsts/client/src/components/common/MenuDashboard.jsx`
  - creates the order (gets `orderNumber`) and navigates to `.../menudash/buy?orderNumber=...`
- `afmc-gsts/client/src/pages/attendant/Pubmenubuy.jsx`
  - shows the order summary and allows quantity updates/cancel
- `afmc-gsts/client/src/pages/common/CartBuy.jsx`
  - bridge page: `/cart/buy` routes into the Pub menu buy screen (uses/creates `orderNumber`)

### Payment + invoice (same as cart flow)

- `afmc-gsts/client/src/pages/common/PaymentPage.jsx`
- `afmc-gsts/client/src/pages/common/InvoicePage.jsx`
- `afmc-gsts/client/src/pages/common/InvoiceReport.jsx`
- wrappers:
  - `afmc-gsts/client/src/pages/attendant/Payment.jsx`
  - `afmc-gsts/client/src/pages/user/Payment.jsx`
  - `afmc-gsts/client/src/pages/attendant/Invoice.jsx`
  - `afmc-gsts/client/src/pages/user/Invoice.jsx`

## Frontend – API/service layer

- `afmc-gsts/client/src/services/Pubmenubuyservice.js`
  - `POST /Pubmenubuy/create`
  - `GET /Pubmenubuy/:ORDER_NUMBER`
  - `PATCH /Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE` (delta quantity)
  - `PUT /Pubmenubuy/:ORDER_NUMBER/line/:ORDER_LINE_ID/quantity` (set line quantity)
  - `DELETE /Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE`
  - `DELETE /Pubmenubuy/:ORDER_NUMBER` (cancel)
- `afmc-gsts/client/src/services/api.js`
  - `cartAPI.proceedToBuy` → `POST /cart/proceed-to-buy` (used by `CartBuy.jsx` when starting buy from cart)
- Payment/invoice services (same as cart flow):
  - `afmc-gsts/client/src/services/orderService.js`
  - `afmc-gsts/client/src/services/Invoiceservice.js`
  - `afmc-gsts/client/src/services/InvoiceReportservice.js`

## Backend (Node/Express) – routes/controllers/models

### Server mount points

- `afmc-gsts/server/server.js`
  - mounts Pub menu buy routes (see file below)

### Pub menu buy

- `afmc-gsts/server/routes/Pubmenubuyroutes.js`
- `afmc-gsts/server/controllers/PubmenubuyController.js`
- `afmc-gsts/server/services/Pubmenubuyservice.js`
- `afmc-gsts/server/models/Pubmenubuymodel.js`

Key endpoints (see `afmc-gsts/server/routes/Pubmenubuyroutes.js`):
- `POST /Pubmenubuy/create`
- `GET /Pubmenubuy/:ORDER_NUMBER`
- `PATCH /Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE`
- `PUT /Pubmenubuy/:ORDER_NUMBER/line/:ORDER_LINE_ID/quantity`
- `DELETE /Pubmenubuy/:ORDER_NUMBER/item/:ITEM_CODE`
- `DELETE /Pubmenubuy/:ORDER_NUMBER`

### Payment + invoice (same backend modules as cart flow)

- Payment: `afmc-gsts/server/routes/paymentRoutes.js`, `afmc-gsts/server/controllers/paymentController.js`
- Invoice: `afmc-gsts/server/routes/invoiceRoutes.js`, `afmc-gsts/server/controllers/invoiceController.js`
- Invoice report: `afmc-gsts/server/routes/InvoiceReportroute.js`, `afmc-gsts/server/controllers/InvoiceReportcontroller.js`

