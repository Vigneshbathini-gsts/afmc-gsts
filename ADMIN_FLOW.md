# Application Overview + Admin Flow (Presentation Notes)

This document is a **presentation script** you can use to explain the AFMC Mess App in a session.
It starts with a simple application overview, then goes deeper into the **Admin flow**.

---

## 1) Overall Application Overview (Basic)

### What this application is
AFMC Mess App is a web application to manage **mess operations** end-to-end:
- Maintain **menu/items** and **inventory**
- Track **stock in/out** (including barcode-based stock entry)
- Handle **orders** and **payments**
- Provide **reports** for stock and order analytics

### Who uses it (roles)
The application supports multiple user roles (RBAC):
- **Admin**: configuration + inventory + reports + user management
- **Kitchen**: kitchen-side order processing and status updates
- **Attendant/Counter**: order handling at the point of service (role may vary by deployment)
- **User/End-user**: places orders and views history (depending on deployment setup)

### Key modules (high-level)
- **Inventory Management**: items, stock, images, accounting units, barcode-based stock staging
- **Orders**: order history, order details, payment method/status tracking
- **Reports**:
  - Bar stock report
  - Order transaction details
  - Order item details
  - PDF export for presenting/record keeping

### What to highlight in the demo (1–2 lines each)
- **Consistency & validation**: required fields and clean UI feedback
- **Operational speed**: scanning barcodes to stage stock quickly
- **Auditability**: reports + total rows + downloadable PDFs

---

## 2) Admin Flow (Deep Dive)

## Login → Admin Dashboard

**What to say**
- “Admin controls master data, inventory, and reporting.”

**What to do**
1. Login with an **Admin** account.
2. Land on the Admin Dashboard:
   - `http://localhost:3000/admin/dashboard`

From the dashboard/sidebar, you can navigate to the modules below.

---

## Inventory Management

**Page**
- `http://localhost:3000/admin/inventory`

### What Admin can do
**What to say**
- “This is the operational heart: items, stock, and images.”

**What to show**
- Inventory table with **Stock** + **A/C Unit**
- Search/filter to quickly locate an item
- Action buttons: **Add Stock**, **Update Image**, **Add Item**

### Add New Item (Create Item)
**What to say**
- “Item creation captures category/subcategory and accounting unit rules to ensure correct stock tracking.”

1. Click **Add Item** (opens Create Item modal).
2. Fill:
   - Item Name
   - Description (optional)
   - Category
   - Sub Category
   - Accounting Unit (auto-filtered based on selected Category/Sub Category; can be changed within allowed values)
   - Preparation Charges (Yes/No)
   - Item Image (optional)
3. Click **Create**.
4. Validation shows errors inside the modal if required fields are missing.

### Add Stock (Item Transaction)
**What to say**
- “We can stage multiple barcodes first, then save in one go.”

1. Click the **Add Stock** action for an item row.
2. Fill transaction fields (date, type, rate, etc).
3. **Type** dropdown is limited to:
   - `Free`
   - `Purchased`
4. Add barcodes:
   - Use **Scan** (camera) or type a barcode in the Barcode field.
   - Rows are staged and shown in the “staged rows” table.
5. Click **Add** to save the staged rows.

### Update Item Image
**What to say**
- “Images make item identification easier for staff.”

1. Click **Update Image** action for an item.
2. Select an image and click **Update**.

---

## Stock Reports

**Overview**
- `http://localhost:3000/admin/stock-reports`

### Bar Stock Report
- `http://localhost:3000/admin/stock-reports/barstock`

**Actions**
**What to say**
- “This report shows available vs reserved stock and supports a PDF export for sharing.”

**What to show**
- Search by item name / item code
- Scroll to load more results (pagination)
- **Download PDF** (uses the same template styling used across reports)
- A/C Unit in InitCap (example: `pegs` → `Pegs`)

### Order Transaction Details
- `http://localhost:3000/admin/stock-reports/order-transaction`

**Actions**
**What to say**
- “Transactions can be filtered and exported for auditing.”

**What to show**
- Filter by date range and optional fields
- Download PDF

### Order Item Details
- `http://localhost:3000/admin/stock-reports/order-item`

**Actions**
**What to show**
- Filter by date range and optional fields
- Download PDF

---

## Order History

**Page**
- `http://localhost:3000/admin/order-history`

### What Admin can do
**What to say**
- “Order History is for day-to-day tracking and reconciliation.”

**What to show**
- Filter by **From/To** date and optional **User Name**
- Quick-search within loaded results
- Download order history PDF
- Click an **Order Number** to open order details

### “Total” Row Behavior
**What to say**
- “The last row is a summary total: it’s intentionally minimal for easy reading.”

**Expected behavior**
- Left columns remain blank
- Only shows:
  - **Payment Status:** `Total`
  - **Amount:** total of all non-total rows
- Payment Method stays empty on the total row

---

## User Management

**Page**
- `http://localhost:3000/admin/users`

**Actions**
**What to say**
- “Admins manage who can access the system and their permissions.”

**What to show**
- Users list
- Edit user details: `http://localhost:3000/admin/users/:id`

---

## Offers

**Pages**
- Offers list: `http://localhost:3000/admin/offers`
- Create offer: `http://localhost:3000/admin/offers/create`
- Edit offer: `http://localhost:3000/admin/offers/edit/:id`

---

## Price Update

**Page**
- `http://localhost:3000/admin/price-update`

---

## Profit Management

**Page**
- `http://localhost:3000/admin/profit-management`

---

## Cocktail Management

**Pages**
- List: `http://localhost:3000/admin/cocktail-management`
- Create: `http://localhost:3000/admin/cocktail-create`
- Edit (via query param):
  - `http://localhost:3000/admin/cocktail-edit?itemId=...`

---

## Cancelled Orders

**Page**
- `http://localhost:3000/admin/cancelled-orders`

---

## 3) Suggested Demo Order (10–15 minutes)

1. Dashboard → explain modules briefly
2. Inventory → show search + item list
3. Add Item → category/subcategory → accounting unit → create
4. Add Stock → type (Free/Purchased) → scan barcode → stage rows → add
5. Bar Stock Report → search → download PDF
6. Order History → filters → show total row → open order details → download PDF

