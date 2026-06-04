# AFMC Mess Developer Guide

This document is a practical onboarding guide for developers who need to understand, run, maintain, or enhance the AFMC Mess application.

## 1. Application Summary

AFMC Mess is a full-stack mess management system used for menu browsing, cart/buy order placement, payment, invoice generation, inventory/stock management, outlet order processing, user management, and reporting.

The application is split into:

- `client/`: React 18 frontend built with Create React App, React Router, Tailwind CSS, Axios, PDF utilities, QR/barcode scanning, and role-based layouts.
- `server/`: Express backend with MySQL access through `mysql2/promise`, JWT authentication, session storage in MySQL, file uploads, reporting, payment, invoice, cart, buy-flow, and inventory APIs.
- `database/`: Starter schema, seed/sample SQL, and migrations.
- `docs/`: Flow-specific and developer documentation.
- `deployment/`: Nginx deployment configuration.

## 2. Technology Stack

Frontend:

- React 18
- React Router DOM v6
- Axios
- Tailwind CSS
- React Toastify and SweetAlert2
- html5-qrcode for scanning
- jsPDF, jsPDF-AutoTable, and html2canvas for PDF/report exports
- Day.js for date handling

Backend:

- Node.js
- Express 5
- MySQL
- `mysql2/promise`
- JWT authentication
- Express session with MySQL session store
- Multer for uploads
- Nodemailer for password reset email

Database:

- MySQL
- Main production-style tables use `xxafmc_...` naming in server queries.
- The checked-in `database/schema.sql` is a starter/minimal schema and does not fully represent every production table used by the app.

## 3. How To Run Locally

### Backend

From `server/`:

```bash
npm install
npm run dev
```

or:

```bash
npm start
```

The backend default port in code is `5000`, but the frontend default API helper expects `7300` for local development. Align these by setting `PORT=7300` in the server environment or by setting `REACT_APP_API_URL` in the client.

### Frontend

From `client/`:

```bash
npm install
npm start
```

The React app starts on port `3000`.

### Common Local URLs

- Frontend: `http://localhost:3000`
- Backend health/root: `http://localhost:7300/AFMCMESS`
- API base: `http://localhost:7300/AFMCMESS/api`

## 4. Environment Variables

Backend variables used by `server/`:

```env
PORT=7300
NODE_ENV=development
BASE_PATH=AFMCMESS

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=afmc_mess

JWT_SECRET=replace_with_secure_secret
SESSION_SECRET=replace_with_secure_session_secret
SESSION_COOKIE_NAME=afmc.sid
SESSION_TABLE_NAME=sessions

CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000

EMAIL_USER=your_email
EMAIL_PASS=your_email_app_password

AFMC_IMAGE_UPLOAD_PATH=/var/www/AFMCIMAGES
AFMC_IMAGE_PUBLIC_BASE_URL=/AFMCMESS/uploads

DEBUG_OFFERS=0
DEBUG_COCKTAIL_STOCK=0
DEDUCT_STOCK_ON_CONFIRM=0
```

Frontend variable:

```env
REACT_APP_API_URL=http://localhost:7300/AFMCMESS/api
```

If `REACT_APP_API_URL` is not set, `client/src/services/api.js` computes a default API URL based on the browser hostname.

## 5. High-Level Architecture

### Frontend Architecture

Important files:

- `client/src/index.js`: React entry point.
- `client/src/App.js`: Wraps the app in `AuthProvider`, `BrowserRouter`, routes, and toast notifications.
- `client/src/routes/AppRoutes.jsx`: Central route map for all roles.
- `client/src/context/AuthContext.jsx`: Stores authenticated user data and cart count.
- `client/src/components/ProtectedRoute.jsx`: Frontend role/outlet/login-type route guard.
- `client/src/services/api.js`: Main Axios instance and grouped API clients.
- `client/src/components/layouts/`: Role-specific page shells.
- `client/src/pages/`: Page-level screens grouped by role/domain.
- `client/src/flows/`: Dedicated cart and buy-flow pages/services.

The frontend stores:

- `token` in `localStorage`
- normalized user object as `authUser` in `localStorage`
- some order-history filters in `sessionStorage`

### Backend Architecture

Important files:

- `server/server.js`: Express app setup, CORS, session store, static uploads, route mounting, error handler.
- `server/config/db.js`: MySQL connection pool and startup connection test.
- `server/middleware/authMiddleware.js`: JWT verification middleware.
- `server/routes/`: Route definitions.
- `server/controllers/`: Request handlers.
- `server/models/`: SQL/data access helpers.
- `server/services/`: Business logic helpers.
- `server/modules/`: Feature modules for cart, pub menu buy, invoice, invoice report, and payment.
- `server/utils/`: Uploads, response handling, role redirection, date helpers, server-sent order events.
- `server/helpers/`: Auth and pricing helper functions.

The backend mounts each API twice:

- `/api/...`
- `/AFMCMESS/api/...` when `BASE_PATH=AFMCMESS`

This supports both local direct API calls and deployed reverse-proxy calls.

## 6. Roles And Route Access

Role checks are mainly configured in `client/src/routes/AppRoutes.jsx` and enforced in `ProtectedRoute`.

Known role patterns:

- Admin: role IDs `10`, `80`
- User/member/end-user: role IDs `20`, `30` depending on login type
- Attendant: role ID `30` with `loginType` of `Member`
- Non-member user flow: role ID `30` with `loginType` of `Non Member`
- Kitchen/Bar outlet: role ID `40` with `outletType` of `KITCHEN` or `BAR`
- Storekeeper: role ID `80` or role code/name `STKP`, `STOREKEEPER`

Backend login flow:

- `POST /auth/get-role` checks the role for a username/email.
- `POST /auth/login` validates user credentials, optionally requires outlet selection for role `40`, creates a JWT, and returns `redirectPath`.
- Passwords are currently compared using MD5-style hashing in auth helpers/controllers.

## 7. Main Frontend Routes

Public:

- `/`
- `/login`
- `/forgot-password`
- `/reset-password/:token`
- `/change-password`
- `/unauthorized`

Admin:

- `/admin/dashboard`
- `/admin/inventory`
- `/admin/add-item`
- `/admin/edit-item`
- `/admin/stock-reports/barstock`
- `/admin/stock-reports/order-transaction`
- `/admin/stock-reports/order-item`
- `/admin/stock-in-out-report`
- `/admin/today-stock-out-details`
- `/admin/users`
- `/admin/users/:id`
- `/admin/offers`
- `/admin/offers/create`
- `/admin/offers/edit/:id`
- `/admin/price-update`
- `/admin/profit-management`
- `/admin/cocktail-management`
- `/admin/cocktail-create`
- `/admin/cocktail-edit`
- `/admin/order-history`
- `/admin/cancelled-orders`

Attendant:

- `/attendant/register-member`
- `/attendant/dashboard`
- `/attendant/menudash`
- `/attendant/menudash/buy`
- `/attendant/cart`
- `/attendant/cart/buy`
- `/attendant/confirm-order`
- `/attendant/payment`
- `/attendant/invoice`
- `/attendant/active-orders`
- `/attendant/order-status`

User:

- `/user/dashboard`
- `/user/menudash`
- `/user/menudash/buy`
- `/user/snacks`
- `/user/drinks`
- `/user/item/:id`
- `/user/cart`
- `/user/cart/buy`
- `/user/confirm-order`
- `/user/payment`
- `/user/invoice`
- `/user/active-orders`
- `/user/order-status`
- `/user/order-history`

Kitchen/Bar:

- `/kitchen/dashboard`
- `/kitchen/order-details`
- `/kitchen/cancelled-orders`
- `/kitchen/order-history`
- `/bar/dashboard`
- `/bar/order-details`
- `/bar/cancelled-orders`
- `/bar/order-history`

Storekeeper:

- `/storekeeper/dashboard`
- `/storekeeper/inventory`
- `/storekeeper/add-item`
- `/storekeeper/edit-item`

## 8. Backend API Areas

The route mounting happens in `server/server.js`.

Main API groups:

- `/auth`: login, get role, change password, forgot/reset password.
- `/users`: user CRUD, role options, bulk upload.
- `/inventory`: inventory list, categories, stock-in/stock-out reports, barcode checks, stock add/out, image upload.
- `/cart`: cart CRUD, proceed-to-buy, confirm order, cocktail customization, ingredient stock checks.
- `/Pubmenubuy`: buy-flow order creation, summary, item quantity update, item delete, cancellation.
- `/orders`: active orders, attendant orders, history, order summary/details, non-member lookup/create.
- `/bar-orders`: kitchen/bar order queue, scan processing, status updates, active orders, cancelled/history details, complete order.
- `/collection`: barcode scan collection records for an order.
- `/invoice`: invoice fetch/create and payment save.
- `/invoice-report`: invoice report fetch.
- `/payment`: payment modes and payment update.
- `/offers`: offers CRUD and offer item lookup.
- `/price`: barcode item lookup and price update.
- `/profit`: member/non-member pricing update and pricing report.
- `/cocktails`: cocktail CRUD and ingredient price/options.
- `/reports`, `/StockReports`, `/ordertransactiondetails`, `/orderitemdetails`: report endpoints.
- `/notifications`: stock-out notifications.
- `/cancelled-orders`: cancelled order reports.
- Menu endpoints directly under API prefix: `/menubar`, `/fetchmocktail`, `/Snacksveg`, `/Snakcnonveg`, `/Drinkhardbeer`, `/DrinkhardCocktail`, etc.
- `/order-events`: server-sent events for order updates.

## 9. Core Business Flows

### Authentication Flow

1. User opens `/login`.
2. Frontend may call `authAPI.getRole` to determine role/outlet behavior.
3. Frontend calls `authAPI.login`.
4. Backend checks `xxafmc_users` and `xxafmc_role`, validates password and active status.
5. Backend returns JWT, normalized user data, and redirect path.
6. Frontend stores `token` and `authUser`.
7. `ProtectedRoute` allows or rejects route access.

### Cart Flow

Use this for normal cart-based checkout.

1. User adds items to cart.
2. Cart data is managed through `/cart` endpoints.
3. User proceeds to buy through `POST /cart/proceed-to-buy`.
4. User confirms order through `POST /cart/confirm-order`.
5. User completes payment.
6. Invoice/report screens fetch invoice data.

Detailed guide: `docs/cart-flow.md`.

### Buy Flow

Use this for direct menu buy / pub menu buy flow.

1. User starts from menu dashboard or cart buy route.
2. Frontend creates or continues a buy order through `/Pubmenubuy/create`.
3. User updates quantities, removes items, or cancels order.
4. User proceeds to payment and invoice.

Detailed guide: `docs/buy-flow.md`.

### Kitchen/Bar Fulfillment Flow

1. Outlet user logs in with role `40` and selects Kitchen or Bar.
2. Frontend routes to `/kitchen/...` or `/bar/...`.
3. Outlet dashboard fetches active orders through `/bar-orders`.
4. Staff can view order details, scan barcodes, cancel items/orders, update status, and complete orders.
5. History and cancelled order pages use `/bar-orders/order-history` and `/bar-orders/cancelled-orders`.

### Inventory And Stock Flow

1. Admin/storekeeper manages inventory under `/admin/inventory` or `/storekeeper/inventory`.
2. Inventory APIs provide categories, subcategories, bar types, item lookup, barcode checks, stock reports, stock add, and stock out.
3. File uploads use the backend upload middleware and are served through `/uploads` and `/AFMCMESS/uploads`.
4. Stock reservation support exists through `xxafmc_stock_reservation_totals`.

### Reporting Flow

Reporting pages usually follow this pattern:

1. Frontend page collects filters.
2. API call fetches filtered rows.
3. UI displays table with totals/summary where needed.
4. PDF export utilities in `client/src/utils/pdfExport.js` generate downloadable reports.

## 10. Database Notes

Important checked-in SQL:

- `database/schema.sql`: starter database and `order_scan_collection` table.
- `database/seed.sql`: seed data.
- `database/sample_data.sql`: sample data.
- `database/migrations/2026-04-14_order_scan_collection_extra_data_longtext.sql`: migration for scan collection extra data.
- `database/migrations/2026-05-11_cart_customization.sql`: creates `xxafmc_cart_customization`.
- `database/migrations/2026-05-26_stock_reservation_totals.sql`: creates `xxafmc_stock_reservation_totals`.

Important table families referenced by code:

- `xxafmc_users`
- `xxafmc_role`
- `xxafmc_cart_customization`
- `xxafmc_stock_reservation_totals`
- `order_scan_collection`
- Additional order, inventory, invoice, cocktail, offer, and pricing tables are referenced throughout models/controllers and may exist in production dump files.

Before setting up a new environment, inspect `database/Dump20260403 (1).sql` and any migration files because `schema.sql` is not a complete production schema.

## 11. Where To Change Common Features

Add or modify frontend route:

- Edit `client/src/routes/AppRoutes.jsx`.
- Add/modify page under `client/src/pages/...` or `client/src/flows/...`.
- Add layout/sidebar/navbar links in `client/src/components/...` if needed.

Add or modify API call:

- Prefer adding methods to `client/src/services/api.js`.
- Reuse the configured Axios instance so JWT and credentials are included automatically.

Add a backend endpoint:

- Add route in `server/routes/...` or the relevant `server/modules/...` route file.
- Add controller logic in `server/controllers/...` or module controller.
- Put database logic in `server/models/...`.
- Put reusable business rules in `server/services/...` or `server/helpers/...`.
- Mount the route in `server/server.js` if it is a new route group.

Add a role-protected screen:

- Add `ProtectedRoute` rules in `AppRoutes.jsx`.
- Confirm `authController.loginUser` returns the needed `roleId`, `roleCode`, `loginType`, and `outletType`.
- Add backend `authMiddleware` to protected API routes.

Add upload/image handling:

- Use `server/utils/uploadMiddleware.js`.
- Confirm `AFMC_IMAGE_UPLOAD_PATH` exists and is writable.
- Confirm public URL behavior through `AFMC_IMAGE_PUBLIC_BASE_URL`.

Add report export:

- Check existing pages under `client/src/pages/admin/StockReportspages/`.
- Reuse helpers in `client/src/utils/pdfExport.js`.

## 12. Coding Conventions In This Repo

Frontend conventions:

- Page-level code is grouped by role under `client/src/pages/`.
- Shared operational UI lives in `client/src/components/common/`.
- Role shells live in `client/src/components/layouts/`.
- API functions are usually centralized in `client/src/services/api.js`, though some feature-specific service files still exist.
- Route names are mixed case in some existing areas; follow the existing route when enhancing rather than renaming casually.

Backend conventions:

- Routes are thin and call controllers.
- Controllers often call models/services directly.
- Database access uses the shared MySQL pool from `server/config/db.js`.
- Most protected routes use `authMiddleware`.
- Some older endpoints are unauthenticated; verify before relying on that behavior.
- Several modules preserve legacy names such as `Pubmenubuy`, `ConfirmOrder`, and `MenuRoutesbeer`.

## 13. Testing And Verification

Available scripts:

```bash
cd client
npm test
npm run build
```

```bash
cd server
npm start
```

There is no dedicated backend automated test script in `server/package.json` at the time of writing.

Manual smoke checks after changes:

- Login as each affected role.
- Verify route access and redirect behavior.
- Check network calls use the expected `/AFMCMESS/api/...` base path.
- Verify cart/buy/payment/invoice flows if order logic changed.
- Verify inventory stock totals and reports if stock logic changed.
- Verify kitchen/bar order status updates if fulfillment logic changed.
- Run frontend build before deployment-facing changes.

## 14. Deployment Notes

Nginx config is in `deployment/nginx/afmcmess.conf`.

Deployment expectations from config:

- Frontend build is served from `/var/www/AFMCMESSapplication`.
- API proxy path is `/AFMCMESS/api/`.
- Upload proxy path is `/AFMCMESS/uploads/`.
- Backend is expected at `http://127.0.0.1:7300`.
- SPA fallback routes requests to `index.html`.

For production:

- Set `NODE_ENV=production`.
- Use strong `JWT_SECRET` and `SESSION_SECRET`.
- Configure SSL and domain in Nginx.
- Ensure upload folder permissions are correct.
- Ensure CORS and `FRONTEND_URL` match the deployed domain.

## 15. Known Technical Notes And Cautions

- The frontend expects API base path `/AFMCMESS/api` by default.
- Backend default `PORT` is `5000`; deployment and frontend defaults imply `7300`.
- Authentication uses JWT plus a MySQL-backed session. JWT is the main API authorization mechanism.
- Password hashing appears to use MD5-compatible helpers. Treat auth changes carefully and plan migrations if upgrading hashing.
- `database/schema.sql` is not a complete representation of all tables used by the application.
- Some paths and filenames retain legacy spelling/casing. Avoid renaming unless you update all imports/routes.
- `TEST_CASES.md` is currently untracked according to git status; do not remove it unless the team decides it is unnecessary.

## 16. Existing Supporting Documents

- `README.md`: Starter project overview.
- `ADMIN_FLOW.md`: Admin demo/presentation flow.
- `docs/cart-flow.md`: Detailed cart checkout flow.
- `docs/buy-flow.md`: Detailed Pub menu buy flow.
- `TEST_CASES.md`: Test case documentation present in the workspace.

Use this guide as the first orientation document, then open the flow-specific docs when working in a specific area.
