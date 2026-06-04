# Test Cases — Module-by-Module UI Scenarios

Purpose
- Module-oriented UI test cases for QA/UAT: organized screen-by-screen starting from Login for traceability and execution.

How to use
- Each module lists the screen(s) and related test cases. Each test case includes: ID, Objective, Preconditions, Steps, Expected Result, Notes.
- No backend endpoint details are included.

---

## Module: Login / Authentication

TC-AUTH-01 — Login with valid credentials
- Objective: Verify login accepts valid credentials and redirects to role dashboard.
- Preconditions: App reachable; valid user exists.
- Steps: Open Login screen → enter valid credentials → submit.
- Expected: Successful login UI (dashboard load), session/token stored in browser, correct role navigation.

TC-AUTH-02 — Login with invalid credentials
- Objective: Verify invalid credentials show error and prevent navigation.
- Steps: Enter invalid credentials → submit.
- Expected: Inline error shown; stay on Login.

TC-AUTH-03 — Login form validation
- Objective: Check client-side validation for empty/invalid fields.
- Steps: Leave fields blank / input invalid formats → attempt submit.
- Expected: Validation messages shown; submit blocked.

TC-AUTH-04 — Forgot password flow (UI)
- Objective: Verify forgot-password screen accepts email and displays confirmation.
- Steps: Open Forgot Password → enter email → submit.
- Expected: Confirmation message displayed; guidance shown to user.

TC-AUTH-05 — Reset password (UI)
- Objective: Verify reset password screen accepts new password and confirms change.
- Steps: Open Reset Password screen → enter new password & confirm → submit.
- Expected: Success message; user can navigate to Login.

TC-AUTH-06 — Change password (logged-in)
- Objective: Verify change-password screen validates current and new password and shows success.
- Preconditions: Authenticated user.
- Steps: Open Change Password → enter current, new, confirm → submit.
- Expected: Success confirmation; session remains valid.

---

## Module: Global Navigation & Role Dashboards

TC-NAV-01 — Role-based landing
- Objective: Verify correct dashboard/link visibility per role after login.
- Steps: Login as each role → observe landing and sidebar/nav items.
- Expected: Only allowed dashboard items visible; links navigate correctly.

TC-DASH-01 — Dashboard rendering (Admin/Attendant/User/Outlet)
- Objective: Each dashboard loads widgets/cards without UI errors.
- Steps: Open dashboard for each role.
- Expected: Widgets display data placeholders or values; no JS errors.

TC-NAV-02 — Responsive navigation
- Objective: Verify top/side navigation collapses and is usable on mobile widths.
- Steps: Resize viewport to mobile → open/close nav → navigate.
- Expected: Navigation usable and readable.

---

## Module: Inventory (Admin / Storekeeper)

TC-INV-01 — Inventory list view
- Objective: Verify inventory page lists items with search, filter, and pagination UI.
- Steps: Open Inventory → perform search, apply filters, paginate.
- Expected: Items update accordingly; no blank screens.

TC-INV-02 — Add item form
- Objective: Verify add-item form validates inputs and accepts image upload.
- Steps: Open Add Item → fill required fields → upload image → submit.
- Expected: Success notification; new item appears in list.

TC-INV-03 — Edit item flow
- Objective: Verify editing fields persists and UI shows updated values.
- Steps: Open item edit → change fields → save → reopen item.
- Expected: Updated values visible; edit validation enforced.

TC-INV-04 — Image upload validation
- Objective: File type and size validation on upload control.
- Steps: Try invalid file / oversized file → observe validation.
- Expected: Clear error message; upload blocked.

---

## Module: Orders (Listing, Details, Cancelled)

TC-ORD-01 — Orders list and filters
- Objective: Orders list UI shows correct columns, search, and filters.
- Steps: Open Orders → filter by date/status → search.
- Expected: List updates; totals or counts reflect filter.

TC-ORD-02 — Order detail view
- Objective: Order detail page displays items, quantities, prices, and actions.
- Steps: Open an order → inspect line items and actions (cancel, reprint, etc.).
- Expected: All details visible and actions enabled when applicable.

TC-ORD-03 — Cancelled orders view
- Objective: Cancelled orders accessible and display reasons/notes.
- Steps: Open Cancelled Orders → open a cancelled order.
- Expected: Cancellation metadata displayed.

---

## Module: Cart → Confirm → Payment → Invoice (User & Attendant)

TC-CART-01 — Add to cart & update quantities
- Objective: Verify add-to-cart from menu/item, quantity updates, and totals.
- Steps: From menu/item screen → add items → open cart → change quantities/remove items.
- Expected: Totals update; UI shows toast/confirmation.

TC-CONF-01 — Confirm order screen
- Objective: Order summary shows items, discounts, taxes, and proceed-to-payment enabled.
- Steps: From cart → proceed to Confirm Order screen.
- Expected: Summary accurate; proceed button enabled when valid.

TC-PAY-01 — Payment UI behavior
- Objective: Payment selection/validation and transition to invoice.
- Steps: On Payment screen → choose method → enter required fields → submit.
- Expected: Payment confirmation shown; invoice accessible.

TC-INV-01 — Invoice view and print/download
- Objective: Invoice screen displays order/payment details and supports print/download.
- Steps: Open Invoice → inspect details → trigger print/download.
- Expected: Invoice content complete; print/download actions available.

---

## Module: Buy Flow (Direct from Menu)

TC-BUY-01 — Buy-now modal and confirmation
- Objective: Verify buy-now modal validates input and creates a confirmation view.
- Steps: Open item modal → choose Buy/Now → fill options → proceed.
- Expected: Confirmation page shows order preview; edits allowed before payment.

TC-BUY-02 — Edit cocktail in buy flow
- Objective: Edit ingredient selection in buy confirmation and reflect changes.
- Steps: On Buy confirmation → Edit cocktail → modify ingredients → save.
- Expected: Updated ingredients visible; totals adjust.

---

## Module: Item Details & Cocktail Customization

TC-ITEM-01 — Item details rendering
- Objective: Item page shows image, description, price, custom options, and add controls.
- Steps: Open Item details → inspect elements and controls.
- Expected: All fields visible and usable.

TC-CKTL-01 — Cocktail ingredient selection
- Objective: Ingredient availability state and selection UI work as expected.
- Steps: On Cocktail item → toggle ingredient selections → add to cart.
- Expected: Disabled ingredients for out-of-stock; selections persist in cart.

TC-CKTL-02 — Edit cocktail from cart
- Objective: Edit saved cocktail in cart and persist changes.
- Steps: From cart → Edit cocktail → change ingredients/quantity → save.
- Expected: Cart item reflects updates.

---

## Module: Offers, Pricing & Profit (Admin)

TC-OFR-01 — Offer create/edit UI
- Objective: Offer form validates inputs, date ranges, and item selection.
- Steps: Open Offers → Create → fill form → save → edit.
- Expected: Offer appears in list; edits persist.

TC-PRC-01 — Price update UI
- Objective: Admin price update workflow reflects in product view.
- Steps: Update price → confirm in product listing/details.
- Expected: Updated price displayed across UI.

---

## Module: Users (Admin)

TC-USR-01 — Create/edit user forms
- Objective: User CRUD UI validates required fields and role assignment.
- Steps: Open Users → Create user → assign role → save → edit.
- Expected: User appears in list; role filters work.

TC-USR-02 — User search & filters
- Objective: User list supports search, role filter, and pagination.
- Steps: Search by name/email → apply role filter.
- Expected: Results narrow appropriately.

---

## Module: Kitchen / Bar (Outlet) Screens

TC-KIT-01 — Outlet active orders list
- Objective: Outlet screen lists active orders with quick actions.
- Steps: Open Outlet dashboard → view active orders.
- Expected: Orders list shows statuses and actions.

TC-KIT-02 — Scan and mark item UI
- Objective: Scanning/manual mark updates scanned vs pending UI states.
- Steps: Open order → use scan or manual entry → mark items.
- Expected: UI marks item scanned; progress updates.

TC-KIT-03 — Update order status (UI)
- Objective: Status change controls are available and reflect in UI.
- Steps: Change status to Preparing/Ready/Completed → observe UI.
- Expected: Status label updates; relevant UI notifications show.

---

## Module: Storekeeper Screens

TC-STORE-01 — Storekeeper dashboard and inventory
- Objective: Verify storekeeper view for inventory summaries and quick actions.
- Steps: Open Storekeeper dashboard → inspect widgets and list.
- Expected: Summaries reflect current inventory counts.

TC-STORE-02 — Storekeeper add/edit items
- Objective: Same validations as Inventory module; storekeeper-specific UI flows.

---

## Cross-cutting & Regression

TC-REG-01 — Role-based access and protected routes (UI)
- Objective: Protected routes hide or redirect unauthorized users.
- Steps: Attempt to access restricted screens with different roles.
- Expected: Access denied UI or redirect to login.

TC-REG-02 — Form validation patterns
- Objective: Common form behaviors are consistent across modules.
- Steps: Submit invalid data in different forms.
- Expected: Consistent validation messages and prevention of submission.

TC-REG-03 — File upload & media handling
- Objective: Image/file upload controls show consistent validation and previews.

TC-REG-04 — Accessibility & responsiveness
- Objective: Key flows work on keyboard navigation and different viewports.

---

Notes
- This module-by-module layout starts with Login and progresses screen-by-screen for traceability during QA and UAT. If you want each test case expanded into full step-by-step templates with test data and expected values, I can expand modules into detailed entries.

Last updated: 2026-06-03

- Preconditions: Registered user exists in backend with valid credentials.
- Test data:
  - username: valid email/service number/username
  - password: valid password
- Steps:
  1. Go to `/login`.
  2. Enter a valid username and password.
  3. If prompted, select outlet type.
  4. Submit the form.
- Expected result:
  - HTTP login request succeeds.
  - `token` is saved to `localStorage`.
  - `user` context is populated.
  - User is redirected to the correct dashboard based on role.
- Notes:
  - Confirm redirect mapping: admin -> `/admin/dashboard`, user -> `/user/dashboard`, attendant -> `/attendant/register-member` or `/attendant/dashboard`, kitchen -> `/kitchen/dashboard`, bar -> `/bar/dashboard`.

### TC-AUTH-02: Login with invalid credentials
- Objective: Verify invalid login is rejected.
- Preconditions: User credentials are incorrect.
- Test data:
  - username: invalid user or wrong format
  - password: incorrect
- Steps:
  1. Go to `/login`.
  2. Enter invalid credentials.
  3. Submit login.
- Expected result:
  - Login request returns an error.
  - Error message displays on the page.
  - No token is stored in `localStorage`.
  - User remains on `/login`.
- Notes:
  - Test both invalid username and valid username + wrong password.

### TC-AUTH-03: Login form validation
- Objective: Confirm inline validation prevents submission of invalid fields.
- Preconditions: None.
- Test data:
  - username: blank or invalid format
  - password: less than 6 characters or blank
- Steps:
  1. Go to `/login`.
  2. Leave fields blank and submit.
  3. Enter invalid formats and submit.
- Expected result:
  - Validation messages display for username and password.
  - Form is not submitted until validation passes.
- Notes:
  - Use the `validateUsername` rules from `Login.jsx`.

### TC-AUTH-04: Role-based access denial
- Objective: Verify protected route logic blocks unauthorized roles.
- Preconditions: Logged-in user has a role outside the target area.
- Test data:
  - Attendant user attempting admin route.
- Steps:
  1. Login as attendant.
  2. Manually navigate to `/admin/inventory`.
- Expected result:
  - User is redirected to `/login`.
  - Existing auth state is cleared.
- Notes:
  - ProtectedRoute uses `allowedRoles`, `roleLoginTypeRules`, and `allowedOutletTypes`.

### TC-AUTH-05: Forgot password request
- Objective: Verify forgot-password flow triggers reset logic.
- Preconditions: Registered email exists.
- Test data:
  - email: registered user email
- Steps:
  1. Go to `/forgot-password`.
  2. Enter registered email.
  3. Submit the request.
- Expected result:
  - API returns success or confirmation message.
  - UI shows a success notification.
- Notes:
  - If email sending is not testable, ensure the endpoint returns success.

### TC-AUTH-06: Reset password with token
- Objective: Validate the reset token flow and new password submission.
- Preconditions: Valid password reset token exists.
- Test data:
  - token: valid reset-token from backend
  - new password: valid password with at least 6 characters
- Steps:
  1. Open `/reset-password/:token`.
  2. Enter a new password and confirm.
  3. Submit the form.
- Expected result:
  - Password is changed successfully.
  - User is able to login with the new password.
- Notes:
  - Test invalid token handling as a negative case.

### TC-AUTH-07: Change logged-in password
- Objective: Confirm password change works for authenticated users.
- Preconditions: User is logged in with a valid session.
- Test data:
  - current password: valid current password
  - new password: valid new password
- Steps:
  1. Go to `/change-password`.
  2. Enter current password, new password, confirm new password.
  3. Submit.
- Expected result:
  - API returns success.
  - UI shows confirmation.
  - User can continue using the application.
- Notes:
  - Test invalid current password and mismatched confirmation.

---

## 2. Admin Workflows

### TC-ADMIN-01: Admin dashboard rendering
- Objective: Verify admin dashboard page loads for authorized admin.
- Preconditions: Logged in as admin role 10 or 80.
- Steps:
  1. Navigate to `/admin/dashboard`.
- Expected result:
  - Dashboard content appears.
  - Admin sidebar and nav items are displayed.
  - Key cards/widgets load without errors.
- Notes:
  - Confirm admin-only sections are present.

### TC-ADMIN-02: Inventory list filtering and pagination
- Objective: Validate inventory list retrieval and filtering behavior.
- Preconditions: Admin is logged in and inventory exists.
- Test data:
  - search text, category filter, barcode filter
- Steps:
  1. Navigate to `/admin/inventory`.
  2. Search for an item by name or barcode.
  3. Apply category filter and verify results.
- Expected result:
  - Inventory items are returned matching criteria.
  - No blank screen or loader hang.
- Notes:
  - Verify sorts and refresh behavior if available.

### TC-ADMIN-03: Add inventory item with image upload
- Objective: Verify admin can add a new inventory item.
- Preconditions: Admin logged in.
- Test data:
  - barcode: valid unique code
  - transactionDate: today
  - item name, quantity, price, unit, category
  - image file: valid JPG/PNG under 2MB
- Steps:
  1. Navigate to `/admin/add-item`.
  2. Scan or type barcode.
  3. Confirm item data loads from backend.
  4. Set quantity and transaction date.
  5. Submit stock-out or create action.
- Expected result:
  - Item is created or stock-out is recorded.
  - Success message appears.
  - Navigation returns to dashboard or stock details.
- Notes:
  - This flow validates `inventoryAPI.getStockOutItemByBarcode` and `createStockOut`.

### TC-ADMIN-04: Edit inventory item details
- Objective: Verify editing an inventory item works.
- Preconditions: Item already exists in inventory.
- Steps:
  1. Navigate to `/admin/edit-item`.
  2. Select an item and modify fields such as price or stock.
  3. Save changes.
- Expected result:
  - Item updates are persisted.
  - Updated values are displayed when reloading.
- Notes:
  - Confirm UI validation on required fields.

### TC-ADMIN-05: View stock reports
- Objective: Validate stock reporting pages and tabbed report navigation.
- Preconditions: Admin logged in.
- Steps:
  1. Navigate to `/admin/stock-reports`.
  2. Switch between `barstock`, `order-transaction`, and `order-item` reports.
  3. Apply any available filters.
- Expected result:
  - Each report table loads data.
  - Data totals and counts appear reasonable.
- Notes:
  - Test report endpoints for both `/stock-report` and detailed report views.

### TC-ADMIN-06: Verify today's stock out details
- Objective: Ensure stock-out detail screen shows recent transactions.
- Preconditions: Stock-out activity has occurred.
- Steps:
  1. Navigate to `/admin/today-stock-out-details`.
- Expected result:
  - List of today’s stock-out transactions is displayed.
  - Date, item, and quantity fields are clear.
- Notes:
  - Useful for verifying the barcode stock-out workflow.

### TC-ADMIN-07: Manage admin users
- Objective: Validate user creation and edit functionality.
- Preconditions: Admin logged in.
- Test data:
  - new email/user details, role, loginType
- Steps:
  1. Navigate to `/admin/users`.
  2. Create a new user.
  3. Open `/admin/users/:id` and edit user details.
- Expected result:
  - New user appears in list.
  - After edit, updated details are saved.
- Notes:
  - Validate required fields and duplicate email handling.

### TC-ADMIN-08: Offer creation and update
- Objective: Confirm admin can manage promotional offers.
- Preconditions: Admin logged in.
- Test data:
  - offer name, discount, valid item references, start/end dates
- Steps:
  1. Navigate to `/admin/offers/create`.
  2. Enter offer details and save.
  3. Navigate to `/admin/offers/edit/:id`.
  4. Update offer conditions.
- Expected result:
  - Offer appears in the offers list.
  - Edited fields are updated and persisted.
- Notes:
  - Includes both create and edit flows.

### TC-ADMIN-09: Pricing and profit management
- Objective: Validate pricing updates and profit rules.
- Preconditions: Admin logged in.
- Steps:
  1. Navigate to `/admin/price-update`.
  2. Update item price.
  3. Save and verify price change.
  4. Navigate to `/admin/profit-management`.
  5. Update member and non-member profit rules.
- Expected result:
  - Pricing update applies successfully.
  - Profit settings save correctly.
- Notes:
  - Check both admin and member pricing endpoints.

### TC-ADMIN-10: Order history and cancelled orders
- Objective: Validate admin visibility of historical and cancelled orders.
- Preconditions: Orders exist in the system.
- Steps:
  1. Open `/admin/order-history`.
  2. Open `/admin/cancelled-orders`.
- Expected result:
  - Order history list loads.
  - Cancelled orders are visible and contain details.
- Notes:
  - Test paging and search if available.

### TC-ADMIN-11: Cocktail management
- Objective: Verify create/edit for cocktail inventory.
- Preconditions: Admin logged in.
- Test data:
  - cocktail name, ingredients, price, image
- Steps:
  1. Navigate to `/admin/cocktail-management`.
  2. Create a new cocktail.
  3. Edit an existing cocktail at `/admin/cocktail-edit`.
- Expected result:
  - Cocktail list updates.
  - Changes persist after refresh.
- Notes:
  - Validate image upload and ingredient selection.

---

## 3. Attendant Workflows

### TC-ATT-01: Attendant dashboard access
- Objective: Ensure attendant dashboard is accessible only to role 30.
- Preconditions: Logged in as attendant.
- Steps:
  1. Navigate to `/attendant/dashboard`.
- Expected result:
  - Dashboard content appears.
  - Attendant-specific widgets and nav items are visible.
- Notes:
  - Attendant users may redirect to register member if non-member.

### TC-ATT-02: Register non-member customer
- Objective: Validate attendant customer registration.
- Preconditions: Attendant logged in.
- Test data:
  - phoneNumber: 10-digit number
  - firstName, lastName
- Steps:
  1. Navigate to `/attendant/register-member`.
  2. Enter phone number.
  3. Wait for lookup (existing number auto-fills name fields).
  4. Enter remaining fields.
  5. Submit.
- Expected result:
  - Customer registers successfully.
  - Navigation returns to attendant dashboard.
- Notes:
  - Validate invalid phone number errors and API lookup behavior.

### TC-ATT-03: Add menu items to attendant cart
- Objective: Verify cart flow for attendant purchase.
- Preconditions: Attendant logged in.
- Steps:
  1. Go to `/attendant/menudash`.
  2. Select one or more items and add to cart.
  3. Open `/attendant/cart`.
- Expected result:
  - Added items are present in cart.
  - Quantities, item subtotals, and total amount are correct.
- Notes:
  - Confirm remove item and quantity update functionality if available.

### TC-ATT-04: Confirm attendant order
- Objective: Validate order confirmation from cart.
- Preconditions: Items are in cart.
- Steps:
  1. Go to `/attendant/confirm-order`.
  2. Review order summary.
  3. Confirm order.
- Expected result:
  - Order summary is displayed.
  - Order confirmation can be submitted without error.
- Notes:
  - Validate display of discounts, offers, and member information.

### TC-ATT-05: Complete payment for attendant order
- Objective: Verify payment workflow.
- Preconditions: Order is confirmed.
- Steps:
  1. Go to `/attendant/payment`.
  2. Enter payment details or choose available payment option.
  3. Submit payment.
- Expected result:
  - Payment is accepted.
  - User is taken to invoice view.
- Notes:
  - Verify invoice generation at `/attendant/invoice`.

### TC-ATT-06: View invoice and invoice report
- Objective: Ensure invoices and reports are accessible.
- Preconditions: Completed orders exist.
- Steps:
  1. View `/attendant/invoice`.
  2. View `/attendant/invoice-report`.
- Expected result:
  - Invoice information is displayed correctly.
  - Invoice report lists recent orders.
- Notes:
  - Confirm invoice print/download actions if present.

### TC-ATT-07: Monitor active orders and statuses
- Objective: Confirm attendant order tracking screens.
- Preconditions: Active orders exist for attendant.
- Steps:
  1. Navigate to `/attendant/active-orders`.
  2. Navigate to `/attendant/order-status`.
- Expected result:
  - Active orders are listed.
  - Status values reflect current order progress.
- Notes:
  - Validate refresh/update behavior.

---

## 4. End User Workflows

### TC-USER-01: User dashboard access
- Objective: Verify user dashboard loads for role 20/30.
- Preconditions: Logged in as user.
- Steps:
  1. Navigate to `/user/dashboard`.
- Expected result:
  - User dashboard appears.
  - Menu and user-specific sections render correctly.
- Notes:
  - Confirm role 30 and 20 share the dashboard.

### TC-USER-02: Browse menu categories
- Objective: Validate browsing `snacks` and `drinks`.
- Preconditions: User logged in.
- Steps:
  1. Go to `/user/snacks`.
  2. Go to `/user/drinks`.
- Expected result:
  - Product lists load.
  - Categories and filters work.
- Notes:
  - Validate product cards and add-to-cart actions.

### TC-USER-03: View item details
- Objective: Confirm item detail page displays correct info.
- Preconditions: Item exists.
- Steps:
  1. Navigate to `/user/item/:id`.
- Expected result:
  - Item title, price, description, and add-to-cart button display.
- Notes:
  - Verify quantity selection behavior if available.

### TC-USER-04: Add to cart and proceed to checkout
- Objective: Validate user purchase flow.
- Preconditions: User is logged in.
- Steps:
  1. Add items to cart from menu or item page.
  2. Open `/user/cart`.
  3. Click checkout or proceed.
  4. Continue to `/user/confirm-order`.
- Expected result:
  - Cart shows the correct order total.
  - Checkout proceeds to confirmation.
- Notes:
  - Test cart quantity updates and remove item behavior.

### TC-USER-05: Complete payment and view invoice
- Objective: Verify user payment flow.
- Preconditions: Order is confirmed.
- Steps:
  1. Navigate to `/user/payment`.
  2. Complete payment form.
  3. Open `/user/invoice`.
- Expected result:
  - Payment succeeds.
  - Invoice page displays order details.
- Notes:
  - Validate invoice download/print if available.

### TC-USER-06: View active orders and order status
- Objective: Verify ongoing order tracking.
- Preconditions: User has active orders.
- Steps:
  1. Go to `/user/active-orders`.
  2. Go to `/user/order-status`.
- Expected result:
  - Active orders are visible.
  - Status detail text matches backend state.
- Notes:
  - Test both order list and status detail pages.

### TC-USER-07: Enduser specialized menu flows
- Objective: Validate end-user-specific flows for role 30.
- Preconditions: Role 30 end user logged in.
- Steps:
  1. Navigate to `/user/Enduserbar`.
  2. Navigate to `/user/EnduserMocktail`.
  3. Navigate to `/user/Snackveg`, `/user/Snacknonveg`, `/user/Drinkharddrink`.
- Expected result:
  - Each endpoint loads its custom menu.
  - Navigation between flows is functional.
- Notes:
  - Ensure element visibility within enduser menu sections.

---

## 4.1 Order Confirmation, Payment, and Invoice Flows

### TC-USER-08: View order confirm page before payment
- Objective: Validate order summary and discount/offer display before payment.
- Preconditions: Items added to cart; user navigated to `/user/confirm-order`.
- Test data:
  - items: multiple items in cart
  - offers/discounts: applied if available
- Steps:
  1. Verify order summary displays all items, quantities, and individual prices.
  2. Check subtotal, tax (if applicable), discount amount, and final total.
  3. Verify member/non-member pricing is applied correctly.
  4. Confirm "Proceed to Payment" button is enabled.
- Expected result:
  - Order summary is accurate and complete.
  - Pricing calculations are correct.
  - All relevant offer/discount details display.
- Notes:
  - Endpoint: `POST /AFMCMESS/api/orders/confirm` or cart confirmation flow.

### TC-USER-09: Complete payment with valid payment method
- Objective: Validate payment form submission and success.
- Preconditions: Order confirmed; user on `/user/payment`.
- Test data:
  - paymentMode: "CREDIT" or "IMMEDIATE" (if Immediate, payment details required)
  - amount: total from order
  - reference: transaction reference (if applicable)
- Steps:
  1. Verify payment form displays correct amount.
  2. Select payment method (Credit/Immediate).
  3. If Immediate, enter payment details.
  4. Click "Complete Payment" or "Pay Now".
  5. Wait for payment processing.
- Expected result:
  - Payment request succeeds.
  - Order status transitions to "Paid" or "Confirmed".
  - User is redirected to invoice page.
- Notes:
  - Endpoint: `POST /AFMCMESS/api/payments` or order payment endpoint.

### TC-USER-10: View invoice after successful payment
- Objective: Validate invoice details page displays correct order and payment info.
- Preconditions: Order paid; user on `/user/invoice` or `/user/invoice/:id`.
- Steps:
  1. Verify invoice displays order number, date, customer details.
  2. Check items list with quantities, unit prices, and line totals.
  3. Confirm subtotal, tax, discount, and grand total.
  4. Verify payment status ("Paid" or "Credit") and payment method.
- Expected result:
  - Invoice contains all required information.
  - Calculations are accurate.
  - Print/download button (if available) is functional.
- Notes:
  - Component: `InvoicePage.jsx`.
  - Test both regular invoice and invoice report view.

### TC-USER-11: View invoice report listing
- Objective: Validate invoice report shows list of user's invoices.
- Preconditions: User has completed multiple orders; on `/user/invoice-report`.
- Steps:
  1. View invoice report list.
  2. Verify columns: Order Number, Date, Amount, Status.
  3. Click on an invoice row to view details.
- Expected result:
  - Invoice list loads.
  - Sorting and filtering (if available) work correctly.
  - Clicking invoice shows detailed view.
- Notes:
  - Endpoint: `GET /AFMCMESS/api/orders/user/history`.

---

## 4.2 Active Orders and Order Tracking

### TC-USER-12: View active orders list
- Objective: Validate active orders page shows current user orders.
- Preconditions: User has active orders; on `/user/active-orders`.
- Steps:
  1. Observe active orders list with order numbers, dates, statuses.
  2. Verify columns display correctly: Order #, Date, Items, Status, Amount.
  3. Click on an order to view details.
- Expected result:
  - Active orders load from backend.
  - Order details display accurately.
  - Real-time status updates show (if supported).
- Notes:
  - Endpoint: `GET /AFMCMESS/api/orders/active`.

### TC-USER-13: View order status tracking
- Objective: Validate order status page shows detailed progress.
- Preconditions: User on `/user/order-status`; active order exists.
- Steps:
  1. Select an order from the list.
  2. View order status timeline (e.g., Confirmed → Preparing → Ready → Completed).
  3. Check estimated completion time if available.
- Expected result:
  - Order status timeline is clear and accurate.
  - Status reflects actual order progress.
  - Timestamps are correct.
- Notes:
  - Status tracking may differ based on order type (dine-in, takeaway, delivery).

### TC-USER-14: View order history
- Objective: Validate order history page shows past completed orders.
- Preconditions: User on `/user/order-history`; completed orders exist.
- Steps:
  1. View list of completed orders with filters (date range, status).
  2. Click "View Invoice" for a past order.
  3. Verify invoice details load correctly.
- Expected result:
  - Order history loads with all past orders.
  - Filters work and narrow results.
  - Invoices are retrievable from history.
- Notes:
  - Endpoint: `GET /AFMCMESS/api/orders/user/history`.

---

## 4.3 Item Details and Cocktail Customization

### TC-USER-15: View item details page
- Objective: Validate item detail page with description and customization options.
- Preconditions: User navigated to `/user/item/:id`.
- Steps:
  1. View item image, name, price, description.
  2. For cocktails, observe ingredient list with checkboxes.
  3. Verify in-stock ingredients are selectable.
  4. Verify out-of-stock ingredients are disabled or marked unavailable.
- Expected result:
  - Item details load correctly.
  - Cocktail ingredients display with availability status.
  - Controls are functional and accessible.
- Notes:
  - Component: `ItemDetails.jsx`.
  - For cocktails, ingredient selection is crucial.

### TC-USER-16: Edit cocktail ingredients for existing cart item
- Objective: Validate cocktail customization during cart edit.
- Preconditions: Cocktail item in cart; user clicked "Edit" button; on `/user/item/:id?cartId=:cartId`.
- Steps:
  1. Observe current ingredient selection.
  2. Deselect an ingredient (if available).
  3. Confirm selection changes.
  4. Click "Save Customization".
  5. Verify cart item is updated with new ingredients.
- Expected result:
  - Ingredient changes are saved.
  - Cart item reflects new recipe.
  - Stock validation passes for new combination.
- Notes:
  - Mode: `isEditingCartItem` in ItemDetails.jsx.
  - Only in-stock ingredients can be selected.

### TC-USER-17: Add customized cocktail to cart from item details
- Objective: Validate adding new cocktail with custom ingredients to cart.
- Preconditions: User on item details page for a cocktail; not editing existing item.
- Steps:
  1. Select desired ingredients (checkboxes).
  2. Set quantity.
  3. Click "Add to Cart".
  4. Verify toast notification.
  5. Navigate to cart and confirm custom cocktail added.
- Expected result:
  - Cocktail with selected ingredients is added to cart.
  - Ingredient selection is preserved in cart.
  - Stock is correctly reserved for selected ingredients.
- Notes:
  - Endpoint: `POST /AFMCMESS/api/cart/add` with ingredient data.

---

## 4.4 Buy Flow (Direct Purchase from Menu)

### TC-USER-18: Initiate buy flow from menu dashboard
- Objective: Validate "Buy Now" action from menu popup.
- Preconditions: User on menu dashboard; item modal open.
- Steps:
  1. Click "Buy" button in item modal (not "Add to cart").
  2. Form validates quantity, remarks, peg type (if applicable).
  3. Submit buy request.
- Expected result:
  - Order creation request is sent to backend.
  - User navigates to `/user/menudash/buy` with order number.
  - Buy confirmation page displays order details.
- Notes:
  - Endpoint: `POST /AFMCMESS/api/pubmenubuy` (from Pubmenubuyservice).
  - This is distinct from cart flow.

### TC-USER-19: View buy flow confirmation page
- Objective: Validate buy order confirmation page before final checkout.
- Preconditions: Buy order created; user on `/user/menudash/buy?orderNumber=X`.
- Steps:
  1. Verify order details display (items, quantities, total).
  2. Check for "Edit Item" button on cocktails.
  3. Verify quantity adjustment controls.
  4. Check for "Proceed to Payment" or "Checkout" button.
- Expected result:
  - Order confirmation page shows correct details.
  - Edit and quantity controls are functional.
  - Proceeding navigates to payment flow.
- Notes:
  - Component: `Pubmenubuy.jsx`.
  - Allows final adjustments before payment.

### TC-USER-20: Edit cocktail ingredients in buy flow
- Objective: Validate ingredient customization in buy confirmation page.
- Preconditions: Cocktail item in buy order; user clicks "Edit" on cocktail row.
- Steps:
  1. Click "Edit" button on cocktail item.
  2. Navigate to ingredient selection page.
  3. Modify ingredient selection.
  4. Save changes.
  5. Return to buy confirmation page.
- Expected result:
  - Ingredient editor opens.
  - Changes are saved to order.
  - Confirmation page reflects updated ingredients.
- Notes:
  - Validates ingredient stock before allowing save.

### TC-USER-21: Complete buy flow with payment
- Objective: Validate complete buy-to-invoice flow.
- Preconditions: Items in buy order; confirmed.
- Steps:
  1. From buy confirmation page, proceed to payment.
  2. Complete payment (same as TC-USER-09).
  3. View invoice.
- Expected result:
  - Full buy flow completes successfully.
  - Invoice is generated and viewable.
- Notes:
  - Confirms buy flow parallels cart flow in final steps.

---

## 5. Kitchen / Bar Workflows (Expanded)

### TC-KITCHEN-01: Outlet dashboard access
- Objective: Ensure kitchen/bar outlet dashboards load for role 40.
- Preconditions: Logged in as outlet user with outletType `KITCHEN` or `BAR`.
- Steps:
  1. Navigate to `/kitchen/dashboard` for kitchen.
  2. Navigate to `/bar/dashboard` for bar.
- Expected result:
  - Outlet dashboard content appears.
  - Correct outlet-specific data is shown.
- Notes:
  - Outlet type gating is enforced by `ProtectedRoute`.

### TC-KITCHEN-02: Order details page
- Objective: Validate order details workflow for outlets.
- Preconditions: Orders exist for the outlet.
- Steps:
  1. Navigate to `/kitchen/order-details` or `/bar/order-details`.
- Expected result:
  - Order list loads.
  - Selected order detail view shows items.
- Notes:
  - Test linking to order item details with `useParams` and query state.

### TC-KITCHEN-03: Cancelled and history orders
- Objective: Verify outlet cancelled orders and history screens.
- Preconditions: Outlet user logged in.
- Steps:
  1. Visit `/kitchen/cancelled-orders`.
  2. Visit `/kitchen/order-history`.
- Expected result:
  - Cancelled orders are displayed.
  - History list shows past orders.
- Notes:
  - Validate both kitchen and bar variants if accessible.

### TC-KITCHEN-04: Scan order items and mark completion
- Objective: Validate item scanning workflow for kitchen/bar.
- Preconditions: Kitchen/bar user on order details page; order has multiple items.
- Steps:
  1. Click "Scan Item" button on an order line item.
  2. Barcode scanner captures or manual entry of item code.
  3. Quantity adjustment if partial scan.
  4. Mark as scanned.
  5. Repeat for all items in order.
  6. After all items scanned, verify order status updates to "Completed" or "Ready".
- Expected result:
  - Scanned items are recorded in session.
  - UI updates to show scanned vs. pending items.
  - Order completion is tracked.
- Notes:
  - Endpoint: `POST /AFMCMESS/api/bar-orders/scan`.
  - Scanned items stored in `bar-orders/scanned-items/`.

### TC-KITCHEN-05: Update order status
- Objective: Validate order status transitions (e.g., Preparing → Ready).
- Preconditions: Kitchen/bar user viewing order details.
- Steps:
  1. Click status dropdown or "Mark as Ready" button.
  2. Select new status (e.g., "Ready for Pickup").
  3. Confirm status change.
- Expected result:
  - Order status updates in real-time.
  - Status change is persisted to database.
  - Status visible to customer if order tracking is enabled.
- Notes:
  - Endpoint: `PUT /AFMCMESS/api/bar-orders/status`.

---

## 5.1 Attendant-Specific Flows (Expanded)

### TC-ATT-08: Register non-member customer detailed
- Objective: Detailed validation of attendant customer registration flow.
- Preconditions: Attendant logged in; navigated to `/attendant/register-member`.
- Test data:
  - phoneNumber: 10-digit valid number (new or existing)
  - firstName, lastName: valid names
  - membershipDetails (if applicable)
- Steps:
  1. Enter phone number and wait for backend lookup.
  2. If existing number, verify auto-populated name fields.
  3. Complete remaining fields.
  4. Submit registration.
  5. Verify success message and return to dashboard.
- Expected result:
  - Phone lookup triggers API call.
  - Existing customer data loads automatically.
  - New customer registers successfully.
  - Cart/order flow uses registered customer details.
- Notes:
  - Endpoint: `GET /AFMCMESS/api/users/lookup-phone` (if exists) and `POST /AFMCMESS/api/users/register`.

### TC-ATT-09: Attendant menudash and cart flow
- Objective: Validate attendant menu and cart operations.
- Preconditions: Attendant logged in as role 30 (Member).
- Steps:
  1. Navigate to `/attendant/menudash`.
  2. Add items to cart.
  3. Open `/attendant/cart`.
  4. Proceed to `/attendant/cart/buy` or `/attendant/confirm-order`.
- Expected result:
  - Menu dashboard displays correctly for attendant.
  - Cart operations work as expected.
  - Order confirmation is accessible.
- Notes:
  - Attendant uses same cart flow as user but may have member-specific pricing.

### TC-ATT-10: Attendant invoice report
- Objective: Validate attendant invoice report showing all processed orders.
- Preconditions: Attendant on `/attendant/invoice-report`.
- Steps:
  1. View list of invoices created by attendant.
  2. Apply date filters if available.
  3. Click invoice to view details.
- Expected result:
  - Attendant invoice report loads.
  - All invoices for attendant's day/period display.
  - Invoice details are accessible.
- Notes:
  - Endpoint: `GET /AFMCMESS/api/invoices/attendant`.

---

## 6. Storekeeper Workflows (Expanded)

### TC-STORE-03: Storekeeper inventory listing with filters
- Objective: Validate storekeeper inventory page with search and filters.
- Preconditions: Storekeeper logged in; on `/storekeeper/inventory`.
- Steps:
  1. View inventory list.
  2. Search by item name or barcode.
  3. Filter by category.
  4. Apply quantity range filter (if available).
- Expected result:
  - Inventory list loads with all items.
  - Search and filters narrow results correctly.
  - Pagination works if inventory is large.
- Notes:
  - Similar to admin inventory but storekeeper-specific.

### TC-STORE-04: Storekeeper add new item with image
- Objective: Validate storekeeper item creation flow.
- Preconditions: Storekeeper on `/storekeeper/add-item`.
- Test data:
  - barcode, item_name, category, quantity, price, image file
- Steps:
  1. Enter barcode (with lookup if supported).
  2. Fill item details.
  3. Upload item image.
  4. Submit.
- Expected result:
  - Item is created and visible in inventory.
  - Image is stored and displays correctly.
  - Stock quantity is initialized.
- Notes:
  - Endpoint: `POST /AFMCMESS/api/inventory/add` or storekeeper-specific endpoint.

### TC-STORE-05: Storekeeper edit item details
- Objective: Validate storekeeper item edit functionality.
- Preconditions: Item exists; storekeeper on `/storekeeper/edit-item`.
- Steps:
  1. Select an item to edit.
  2. Modify item name, price, or quantity.
  3. Save changes.
- Expected result:
  - Item updates are persisted.
  - Changes reflect in inventory list.
- Notes:
  - Validate required fields and image re-upload if needed.

---

## 7. Admin Workflows (Expanded - Reports)

### TC-ADMIN-12: View barstock report
- Objective: Validate barstock report with current inventory levels.
- Preconditions: Admin on `/admin/stock-reports/barstock`.
- Steps:
  1. View barstock report table.
  2. Columns: Item Name, Barcode, Category, Current Stock, Unit Price, Stock Value.
  3. Apply date filter if available.
  4. Export or print report if available.
- Expected result:
  - Barstock report displays current inventory.
  - All columns show correct data.
  - Report totals are accurate.
- Notes:
  - Endpoint: `GET /AFMCMESS/api/stock-reports/barstock`.

### TC-ADMIN-13: View order transaction report
- Objective: Validate order transaction details report.
- Preconditions: Admin on `/admin/stock-reports/order-transaction`.
- Steps:
  1. View transaction report with order details.
  2. Columns: Order #, Date, Customer, Item, Qty, Unit Price, Total.
  3. Apply date range filter.
- Expected result:
  - Order transaction report loads.
  - Transactions are listed with accurate details.
  - Totals and summaries are correct.
- Notes:
  - Endpoint: `GET /AFMCMESS/api/stock-reports/order-transaction`.

### TC-ADMIN-14: View order item details report
- Objective: Validate order item-level report.
- Preconditions: Admin on `/admin/stock-reports/order-item`.
- Steps:
  1. View order item report.
  2. Columns: Order #, Item, Qty Ordered, Qty Scanned, Status, Date.
  3. Filter by item or order.
- Expected result:
  - Order item report displays item-level details.
  - Discrepancies (if any) between ordered and scanned quantities are visible.
- Notes:
  - Useful for identifying partial order fulfillment.

### TC-ADMIN-15: View profit management report
- Objective: Validate profit report and member vs. non-member breakdown.
- Preconditions: Admin on `/admin/profit-management`.
- Steps:
  1. View profit settings for member and non-member.
  2. Update profit percentages or margins.
  3. Save changes.
  4. Verify report recalculates with new settings.
- Expected result:
  - Profit settings display correctly.
  - Changes are saved and applied to future orders.
  - Report reflects updated profit calculations.
- Notes:
  - Endpoint: `GET /AFMCMESS/api/profit/report` and update endpoints.

---


### TC-KITCHEN-01: Outlet dashboard access
- Objective: Ensure kitchen/bar outlet dashboards load for role 40.
- Preconditions: Logged in as outlet user with outletType `KITCHEN` or `BAR`.
- Steps:
  1. Navigate to `/kitchen/dashboard` for kitchen.
  2. Navigate to `/bar/dashboard` for bar.
- Expected result:
  - Outlet dashboard content appears.
  - Correct outlet-specific data is shown.
- Notes:
  - Outlet type gating is enforced by `ProtectedRoute`.

### TC-KITCHEN-02: Order details page
- Objective: Validate order details workflow for outlets.
- Preconditions: Orders exist for the outlet.
- Steps:
  1. Navigate to `/kitchen/order-details` or `/bar/order-details`.
- Expected result:
  - Order list loads.
  - Selected order detail view shows items.
- Notes:
  - Test linking to order item details with `useParams` and query state.

### TC-KITCHEN-03: Cancelled and history orders
- Objective: Verify outlet cancelled orders and history screens.
- Preconditions: Outlet user logged in.
- Steps:
  1. Visit `/kitchen/cancelled-orders`.
  2. Visit `/kitchen/order-history`.
- Expected result:
  - Cancelled orders are displayed.
  - History list shows past orders.
- Notes:
  - Validate both kitchen and bar variants if accessible.

---

## 6. Storekeeper Workflows

### TC-STORE-01: Storekeeper dashboard access
- Objective: Validate storekeeper landing page.
- Preconditions: Logged in as role 80/STOREKEEPER.
- Steps:
  1. Navigate to `/storekeeper/dashboard`.
- Expected result:
  - Dashboard content renders.
- Notes:
  - Confirm only storekeeper role can access this route.

### TC-STORE-02: Storekeeper inventory CRUD
- Objective: Validate storekeeper inventory management.
- Preconditions: Storekeeper logged in.
- Steps:
  1. Go to `/storekeeper/inventory`.
  2. Add a new item via `/storekeeper/add-item`.
  3. Edit item via `/storekeeper/edit-item`.
- Expected result:
  - Inventory list updates correctly.
  - Added and edited items persist.
- Notes:
  - Verify form validation and image handling if available.

---

## 7. Backend API Test Cases

### TC-API-01: API health and base path
- Objective: Verify server is reachable through base API path.
- Preconditions: Backend server is running.
- Steps:
  1. Send GET to `/AFMCMESS`.
  2. Send GET to `/AFMCMESS/api`.
- Expected result:
  - Response code 200.
  - Response contains `status: "Server is running"`.
- Notes:
  - Confirm `BASE_PATH` handling in `server.js`.

### TC-API-02: Auth endpoints
- Objective: Validate authentication API responses.
- Endpoints:
  - `POST /AFMCMESS/api/auth/login`
  - `POST /AFMCMESS/api/auth/register`
  - `POST /AFMCMESS/api/auth/forgot-password`
  - `POST /AFMCMESS/api/auth/reset-password`
  - `POST /AFMCMESS/api/auth/change-password`
- Expected result:
  - Valid payloads succeed.
  - Invalid payloads return 4xx and clear messages.
- Notes:
  - Verify JWT token issuance on login.

### TC-API-03: User management endpoints
- Objective: Validate user CRUD endpoints.
- Endpoints:
  - `GET /AFMCMESS/api/users`
  - `GET /AFMCMESS/api/users/:id`
  - `POST /AFMCMESS/api/users`
  - `PUT /AFMCMESS/api/users/:id`
- Expected result:
  - Protected endpoints require authentication.
  - Data changes persist in the database.
- Notes:
  - Ensure new user creation handles required roles.

### TC-API-04: Order endpoints
- Objective: Verify order retrieval and non-member flows.
- Endpoints:
  - `GET /AFMCMESS/api/orders/active`
  - `GET /AFMCMESS/api/orders/attendant`
  - `GET /AFMCMESS/api/orders/history`
  - `GET /AFMCMESS/api/orders/:id/summary`
  - `GET /AFMCMESS/api/orders/:id/details`
  - `GET /AFMCMESS/api/orders/user/history`
  - `POST /AFMCMESS/api/orders/non-member`
- Expected result:
  - Correct order payloads return.
  - Non-member creation and lookup work.
- Notes:
  - Include negative tests for invalid order IDs.

### TC-API-05: Inventory endpoints
- Objective: Validate stock and inventory APIs.
- Endpoints:
  - `GET /AFMCMESS/api/inventory`
  - `GET /AFMCMESS/api/inventory/categories`
  - `GET /AFMCMESS/api/inventory/items`
  - `GET /AFMCMESS/api/inventory/stock-out-report`
  - `POST /AFMCMESS/api/inventory/add-stock`
  - `POST /AFMCMESS/api/inventory/stock-out`
- Expected result:
  - Inventory data is returned correctly.
  - Stock add/out operations update available stock.
- Notes:
  - Test both success and insufficient stock conditions.

### TC-API-06: Offers and pricing
- Objective: Validate offer and pricing updates.
- Endpoints:
  - `GET /AFMCMESS/api/offers`
  - `POST /AFMCMESS/api/offers`
  - `PUT /AFMCMESS/api/offers/:id`
  - `GET /AFMCMESS/api/price/barcode/:barcode`
  - `PUT /AFMCMESS/api/price/price-update`
  - `PUT /AFMCMESS/api/profit/member`
  - `PUT /AFMCMESS/api/profit/non-member`
- Expected result:
  - Offer creation and edit persist.
  - Price lookup returns correct price data.
- Notes:
  - Confirm offer status and validity dates.

### TC-API-07: Notifications and reports
- Objective: Validate notification marking and reporting APIs.
- Endpoints:
  - `GET /AFMCMESS/api/notifications/stock-out`
  - `PUT /AFMCMESS/api/notifications/stock-out/read/:itemCode`
  - `GET /AFMCMESS/api/profit/report`
  - `GET /AFMCMESS/api/stock-reports/stock-report`
- Expected result:
  - Notification lists load properly.
  - Mark-read actions return success.
- Notes:
  - Test report generation with filters.

### TC-API-08: Kitchen order endpoints
- Objective: Validate kitchen/bar-specific order operations.
- Endpoints:
  - `GET /AFMCMESS/api/bar-orders/active`
  - `PUT /AFMCMESS/api/bar-orders/status`
  - `POST /AFMCMESS/api/bar-orders/scan`
- Expected result:
  - Order status updates succeed.
  - Scan results are stored in session and returned properly.
- Notes:
  - Test both active order retrieval and status transitions.

### TC-API-09: Menu and user purchase endpoints
- Objective: Validate menu endpoints used by UI flows.
- Endpoints:
  - `GET /AFMCMESS/api/menubar`
  - `GET /AFMCMESS/api/fetchmocktail`
  - `GET /AFMCMESS/api/Snacksveg`
  - `GET /AFMCMESS/api/Snakcnonveg`
  - `GET /AFMCMESS/api/Drinkhardbeer`
  - `GET /AFMCMESS/api/memupopup`
- Expected result:
  - Menu lists return items.
  - UI menu screens can render from responses.
- Notes:
  - Confirm endpoints work for both attendant and end user flows.

---

## 8. Cross-cutting and Regression Tests


### TC-REG-01: Role-based navigation and authorization
- Objective: Ensure page access is restricted to allowed roles.
- Preconditions: Multiple users with different roles exist.
- Steps:
  1. Login as each role.
  2. Attempt to visit pages not allowed to that role.
- Expected result:
  - Unauthorized routes redirect to `/login`.
  - Protected routes do not render sensitive data.
- Notes:
  - Check `ProtectedRoute.jsx` logic for role and outlet type.

### TC-REG-02: Form validation and error handling
- Objective: Confirm that required forms validate input and display errors.
- Preconditions: UI forms available.
- Steps:
  1. Submit blank or invalid forms.
  2. Verify field-level validation messages.
- Expected result:
  - Errors display and prevent submission.
  - Backend returns clear validation errors for invalid input.
- Notes:
  - Include login, registration, item creation, offer creation, and price update forms.

### TC-REG-03: File upload validation
- Objective: Validate image upload rules.
- Preconditions: Image upload is supported on item/cocktail forms.
- Steps:
  1. Upload valid image file under 2MB.
  2. Upload invalid file type or file over 2MB.
- Expected result:
  - Valid upload succeeds.
  - Invalid upload returns error message `Image size must be 2MB or less.`
- Notes:
  - Use backend file upload handler error path in `server.js`.

### TC-REG-04: Session and token handling
- Objective: Verify session lifetimes and forced logout.
- Preconditions: User logged in.
- Steps:
  1. Login successfully.
  2. Delete or invalidate token.
  3. Reload protected page.
- Expected result:
  - Session is cleared.
  - User is redirected to `/login`.
- Notes:
  - Confirm `ForceLogoutNavigate` clears `localStorage`.

### TC-REG-05: 404 and navigation resilience
- Objective: Ensure invalid routes show the NotFound page.
- Preconditions: App routes are available.
- Steps:
  1. Navigate to an invalid URL.
  2. Confirm 404 page appears.
- Expected result:
  - The `NotFound` component renders.
  - Application navigation remains functional.
- Notes:
  - Test sidebar links and deep-link routes.

---

## 9. UI-Based Menu & Cart Test Cases

### TC-UI-MENU-01: Browse menu dashboard with item cards
- Objective: Verify menu dashboard displays item cards with stock status and filtering.
- Preconditions: User logged in and navigated to `/user/menudash`.
- Steps:
  1. Open the menu dashboard page.
  2. Observe the item cards displayed in a grid (drinks/snacks sections).
  3. Verify each card shows item image, name, and stock status badge if applicable.
  4. Switch between "Drinks" and "Snacks" tabs.
  5. For drinks, switch between "Soft Drinks" and "Hard Drinks" sections.
  6. For soft drinks, select different categories (e.g., "Others", "Mocktails").
- Expected result:
  - Item cards render in a responsive grid layout.
  - Out-of-stock items appear visually grayed out or with a red badge.
  - Category filters and tabs update the item list dynamically.
  - Item images load correctly from the base API URL.
- Notes:
  - Confirm `MenuGrid`, `ProgressiveMenuGrid`, and `EnduserMocktailSection` components load.
  - Stock availability is fetched via `cartAPI.getIngredientStocks()`.

### TC-UI-MENU-02: Click on regular item card and open popup
- Objective: Validate item popup modal opens when clicking an in-stock regular item.
- Preconditions: User on menu dashboard; at least one regular (non-cocktail) in-stock item exists.
- Steps:
  1. Locate and click on a regular item card (e.g., a beer or snack).
  2. Modal popup opens showing item details.
  3. Observe item image, name, price, A/C unit, quantity input, remarks dropdown.
- Expected result:
  - Modal overlay appears with backdrop.
  - Item details fetch via `/memupopup` API and display correctly.
  - Close button (X) and Cancel button are present.
- Notes:
  - Modal is rendered by `MenuPopupCompact` component.
  - Quantity defaults to "1" and remarks default to "Din".

### TC-UI-MENU-03: Attempt to click on out-of-stock regular item
- Objective: Verify out-of-stock regular items show alert and do not open modal.
- Preconditions: User on menu dashboard; at least one out-of-stock regular item visible.
- Steps:
  1. Click on an out-of-stock regular item card.
  2. Observe the interaction.
- Expected result:
  - Out-of-stock alert appears: "This item is out of stock."
  - Modal popup does NOT open.
  - Item card remains visually disabled (grayed out).
- Notes:
  - `handleItemClick` function validates `isOutOfStock()` before opening modal.
  - Regular items with `stock_status = "Out Of Stock"` are blocked from modal.

### TC-UI-MENU-04: Click on cocktail/mocktail item card
- Objective: Verify cocktail/mocktail items open modal without stock check blocking.
- Preconditions: User on menu dashboard; at least one cocktail or mocktail item exists.
- Steps:
  1. Locate a cocktail or mocktail item (from sub_category 14 or 15).
  2. Click the item card.
  3. Modal popup opens.
- Expected result:
  - Modal opens regardless of ingredient stock status (stock check does NOT block opening).
  - Cocktail details and ingredient info are available for later validation.
- Notes:
  - `isCocktailOrMocktailItem()` function identifies cocktails/mocktails.
  - Stock validation for ingredients happens at cart-add time, not at modal-open time.

### TC-UI-MENU-05: Adjust quantity and remarks in item modal
- Objective: Validate quantity and remarks controls work in modal.
- Preconditions: Item modal is open.
- Test data:
  - quantity: 2, 3, 5
  - remarks: "Din" or "Take Away"
  - pegType (if applicable): "Small" or "Large"
- Steps:
  1. Adjust quantity using +/- buttons or type directly in input.
  2. Change remarks from "Din" to "Take Away" using dropdown.
  3. If A/C unit is "Pegs", select peg type from dropdown.
- Expected result:
  - Quantity field updates correctly.
  - Remarks dropdown reflects selected value.
  - Peg type dropdown (if applicable) shows options and selection works.
- Notes:
  - Quantity input type="number" with min="1".
  - For cocktails/mocktails, max quantity is limited to 5.

### TC-UI-MENU-06: Add in-stock regular item to cart via modal
- Objective: Verify adding a regular in-stock item via modal succeeds and displays in cart.
- Preconditions: Item modal open for in-stock regular item.
- Test data:
  - item: Regular item (e.g., beer, snack)
  - quantity: 2
  - remarks: "Din"
- Steps:
  1. Set quantity to 2.
  2. Set remarks to "Din".
  3. Click "Add to cart" button.
  4. Toast notification appears: "Item added to cart!".
  5. Modal closes automatically.
  6. Navigate to `/user/cart`.
- Expected result:
  - Item is added to cart with correct quantity.
  - Cart page shows the item in the items grid.
  - Item quantity, name, and price display correctly.
  - Cart count in navbar updates.
- Notes:
  - Backend validates stock via `cartAPI.getIngredientStocks()` before adding.
  - Success toast auto-closes modal after 1.2 seconds.

### TC-UI-MENU-07: Attempt to add out-of-stock regular item from modal
- Objective: Verify out-of-stock regular items cannot be added to cart from modal.
- Preconditions: Regular item modal is open (hypothetically for out-of-stock item); item details show out-of-stock status.
- Steps:
  1. Observe the modal shows an out-of-stock warning: "This item is currently out of stock and cannot be added to cart."
  2. Note "Add to cart" button is disabled (grayed out).
  3. Attempt to click "Add to cart" button.
- Expected result:
  - Button is disabled and does not respond.
  - "Add to cart" button shows disabled state with `cursor-not-allowed` and `opacity-70`.
  - Modal remains open.
- Notes:
  - In current flow, out-of-stock regular items are blocked from opening modal (see TC-UI-MENU-03).
  - This test validates secondary safety: modal should handle out-of-stock gracefully if opened.

### TC-UI-MENU-08: Add cocktail/mocktail item with available ingredients
- Objective: Validate cocktail/mocktail item adds to cart if ingredients are in stock.
- Preconditions: Cocktail modal open; all ingredients have sufficient available stock.
- Test data:
  - cocktail: Mocktail (sub_category 15)
  - quantity: 1 or 2
  - ingredients: Pre-configured in backend with available stock > required pegs
- Steps:
  1. Verify modal displays cocktail name and details.
  2. Set quantity to 1 or 2.
  3. Click "Add to cart" button.
  4. Wait for ingredient stock validation (API call).
  5. Toast: "Item added to cart!".
  6. Modal closes.
  7. Navigate to `/user/cart`.
- Expected result:
  - Cocktail item is added to cart with correct quantity.
  - Cart displays the cocktail item.
  - Cocktail item shows "Edit" button (for future ingredient customization in cart).
- Notes:
  - Ingredient validation happens via `barOrdersAPI.getCocktailDetailsById()` and `cartAPI.getIngredientStocks()`.
  - Each ingredient requires `pegs * quantity <= available stock`.

### TC-UI-MENU-09: Attempt to add cocktail with insufficient ingredient stock
- Objective: Verify cocktail add fails with error if any ingredient is out of stock.
- Preconditions: Cocktail modal open; at least one ingredient has insufficient available stock.
- Test data:
  - cocktail: Mocktail with 2 ingredients
  - ingredient 1: rum, available: 10 pegs, required: 15 pegs (for qty 5)
  - quantity: 5
- Steps:
  1. Set quantity to 5.
  2. Click "Add to cart".
  3. API validates ingredients.
- Expected result:
  - Toast error appears: "Out of stock for ingredient rum. Available quantity: 10"
  - Cocktail is NOT added to cart.
  - Modal remains open.
- Notes:
  - Backend checks: `required = ingredient.pegs * quantity`.
  - If `required > available`, add-to-cart is blocked.

### TC-UI-MENU-10: Add item via "Buy Now" action
- Objective: Validate "Buy Now" button initiates direct order flow (if available).
- Preconditions: Item modal open.
- Steps:
  1. Locate "Buy" button in modal.
  2. Click "Buy".
  3. Validate preconditions (remarks, quantity, peg type if applicable).
- Expected result:
  - Direct order flow is initiated (e.g., navigate to buy confirmation page).
  - Or validation error appears if preconditions are unmet.
- Notes:
  - This flow validates `handleBuyNow` callback and `onBuy` handler.
  - Buy flow may differ from add-to-cart flow for attendant/user roles.

---

### TC-UI-CART-01: View cart items grid layout
- Objective: Verify cart page displays items in a grid with all necessary controls.
- Preconditions: User has items in cart; navigated to `/user/cart`.
- Steps:
  1. Open cart page.
  2. Observe items displayed in a responsive grid (1 col mobile, 2 cols tablet, 3-4 cols desktop).
  3. For each item card, verify:
     - Item image with fallback placeholder
     - Item name (truncated if long)
     - Stock status (In Stock / Out Of Stock)
     - Quantity controls (-, qty input, +)
     - Edit button (for cocktails/mocktails)
     - Remove button (trash icon)
- Expected result:
  - All items render in the grid layout.
  - Controls are accessible and properly positioned.
  - Stock status color matches status (green for "In Stock", red for "Out Of Stock").
- Notes:
  - Components: `CartPage.jsx` grid rendering and item card layout.

### TC-UI-CART-02: Update item quantity via +/- controls
- Objective: Validate quantity updates via UI controls work and persist.
- Preconditions: Cart page with items; item quantity is 1.
- Steps:
  1. Click + button to increase quantity from 1 to 2.
  2. Observe API call (optimistic update).
  3. Toast notification: "Quantity updated successfully".
  4. Item quantity displays as 2.
  5. Click - button to decrease quantity from 2 to 1.
  6. Verify quantity returns to 1.
- Expected result:
  - Quantity updates immediately in UI.
  - API endpoint `cartAPI.updateQuantity()` is called.
  - Toast notification confirms update.
  - Quantity persists on page refresh.
- Notes:
  - `handleQuantityUpdate` handles both increase and decrease.
  - For cocktails, stock validation of ingredients occurs before update.

### TC-UI-CART-03: Validate stock before quantity increase for regular item
- Objective: Verify quantity increase is blocked if new quantity exceeds available stock.
- Preconditions: Regular item in cart with available stock = 2; current quantity = 1.
- Steps:
  1. Click + button to increase quantity from 1 to 2 (should succeed).
  2. Click + button again to increase from 2 to 3 (should exceed available stock of 2).
- Expected result:
  - First increase (1→2) succeeds.
  - Second increase (2→3) is blocked with toast: "Out of stock. Available quantity: 2".
  - Quantity remains 2.
- Notes:
  - `getMaxAllowedQuantity()` returns available stock.
  - Stock check happens before `cartAPI.updateQuantity()` is called.

### TC-UI-CART-04: Validate stock before quantity increase for cocktail item
- Objective: Verify cocktail quantity increase is blocked if ingredients are insufficient.
- Preconditions: Cocktail item in cart; ingredient has available stock = 5 pegs; ingredient required = 2 pegs per cocktail; current quantity = 2 (4 pegs used).
- Steps:
  1. Click + to increase quantity from 2 to 3 (would require 6 pegs, exceeds available 5).
- Expected result:
  - Quantity increase is blocked with toast: "Out of stock for ingredient [name]. Available quantity: 5".
  - Quantity remains 2.
- Notes:
  - Ingredient validation happens in `handleQuantityUpdate` for cocktails.
  - Fetches cocktail details via `cartAPI.getCocktailDetails(cartId)`.

### TC-UI-CART-05: Edit cocktail item to customize ingredients
- Objective: Validate edit button navigates to ingredient customization page.
- Preconditions: Cocktail item in cart; item card has "Edit" button.
- Steps:
  1. Click "Edit" button (pencil icon) on cocktail item card.
  2. Verify navigation to `/user/item/:itemId?cartId=:cartId`.
  3. Ingredient customization page loads with current cocktail details.
- Expected result:
  - Navigation succeeds with cartId passed as query param.
  - Ingredient page shows current recipe with checkboxes to select/deselect ingredients.
  - User can modify which ingredients are included.
- Notes:
  - `handleEditItem` function prepares the navigation params.
  - Ingredient page validates that only in-stock ingredients can be selected.

### TC-UI-CART-06: Remove item from cart via trash button
- Objective: Validate item removal from cart.
- Preconditions: Cart has multiple items.
- Steps:
  1. Click trash icon on an item card.
  2. Confirmation modal appears: "Are you sure you want to remove this item from your cart?"
  3. Click "Remove" button in confirmation.
  4. Confirm modal closes.
- Expected result:
  - Item is removed from cart immediately.
  - Cart item count decreases.
  - Toast: "Item removed from cart".
  - If cart becomes empty, user is redirected to menu dashboard.
- Notes:
  - `handleRemoveItem` function handles deletion via `cartAPI.deleteItem(cartId)`.
  - Confirmation modal prevents accidental deletions.

### TC-UI-CART-07: Cart shows out-of-stock alert for regular items
- Objective: Verify out-of-stock status is displayed visually for unavailable items.
- Preconditions: Item in cart has stock_status = "Out Of Stock" or availableQuantity = 0.
- Steps:
  1. Open cart page.
  2. Observe item card with out-of-stock status.
  3. Verify visual feedback: grayed item image with "Out of Stock" label overlay.
- Expected result:
  - Out-of-stock items are clearly marked.
  - Item image opacity is reduced.
  - Stock status text shows "Out Of Stock" in red.
  - Item quantity controls are disabled or show warning.
- Notes:
  - `effectiveOutOfStock` flag determines visual state.
  - `imageStockMessage` renders overlay on item image if out-of-stock.

### TC-UI-CART-08: Proceed to buy with valid items
- Objective: Validate "Proceed to buy" button and checkout flow.
- Preconditions: Cart has items; navigated to `/user/cart`.
- Steps:
  1. Click "Proceed to buy" button.
  2. Confirmation modal: "Are you sure you want to proceed to buy?".
  3. Click "Yes, proceed".
  4. Confirm modal closes.
- Expected result:
  - Order is confirmed via `cartAPI.confirmOrder()`.
  - Navigation to `/user/cart/buy?orderNumber=X` with order number state.
  - Order number is obtained from response.
- Notes:
  - `handleProceedConfirm` handles the confirmation logic.
  - Buy page displays order items with final validation and payment options.

### TC-UI-CART-09: Empty cart message
- Objective: Verify empty cart state displays message and options.
- Preconditions: Cart is empty; navigated to `/user/cart`.
- Steps:
  1. Observe the cart page when no items are present.
- Expected result:
  - Message displays: "No items in the cart."
  - "Proceed to buy" button is disabled.
  - "Go to menu" button is enabled and navigates to menu dashboard.
- Notes:
  - Empty state handled by conditional rendering in `CartPage`.

### TC-UI-CART-10: Cart persists after page reload
- Objective: Verify cart data is fetched fresh from backend on page load.
- Preconditions: Items added to cart.
- Steps:
  1. Add items to cart.
  2. Refresh the cart page (F5 or reload).
  3. Observe cart items after reload.
- Expected result:
  - Cart items are re-fetched from `cartAPI.getByUserId(userId)`.
  - All items, quantities, and stock statuses are intact.
  - UI matches backend state.
- Notes:
  - `fetchCartItems` is called in `useEffect` on component mount.

---

## 10. Test Data and Environment Setup

- Use MySQL database with seed data from `database/sample_data.sql`.
- Ensure `.env` values are configured for `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `BASE_PATH`.
- Use a test account for each role:
  - Admin: roleId 10 / 80
  - Attendant: roleId 30
  - User: roleId 20 / 30 (Non Member)
  - Kitchen/Bar: roleId 40 with `outletType=KITCHEN` or `BAR`
  - Storekeeper: roleId 80 or `STOREKEEPER`
- Clear browser storage between runs to avoid stale tokens.

---

## 10. Recommended Test Coverage

- Functional UI tests for each major role and page flow.
- Integration tests for API flows: auth, orders, inventory, pricing, notifications.
- Regression tests for role-based protection and navigation.
- Smoke tests for app startup, login, and dashboard rendering.
- Performance/sanity tests for critical checkout and order submission flows.
