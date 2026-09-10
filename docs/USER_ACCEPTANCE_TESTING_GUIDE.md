# Pepsi Regional Office Stock & Sales Software
# User Acceptance Testing Guide

---

## 1. Purpose of This Guide

This document is a complete, non-technical testing manual designed for business users, office managers, cashiers, and warehouse supervisors. Its goal is to allow anyone to sit in front of a standard web browser and verify every single feature of the **Pepsi Regional Office Stock & Sales Software** without needing any computer programming or technical knowledge.

By following this guide from top to bottom, you will confirm that:
- Every business operation (receiving inventory, selling drinks, tracking crates, processing customer returns, counting stock, balancing the daily cash drawer, and generating reports) behaves accurately.
- Sensitive financial data (such as product cost prices and profit margins) is kept strictly private to the Business Owner.
- Accidental mistakes (such as selling more crates than are physically in the warehouse or giving credit to an unnamed customer) are safely blocked by the system with clear, helpful explanations.

---

## 2. Who Should Perform the Testing

This testing should be performed by representative business personnel:
1. **The Business Owner or Regional General Manager:** To verify executive controls, profit reports, staff account setup, price changes, and stock adjustment approvals.
2. **A Cashier / Sales Clerk:** To verify invoice generation, customer credit tracking, payment collection, and daily closing.
3. **A Warehouse Supervisor:** To verify delivery intakes, physical stock counting, crate returns, and damaged stock write-offs.

No technical background, coding skills, or special software installation is required. Everything is tested directly inside a standard web browser like Google Chrome, Microsoft Edge, Safari, or Mozilla Firefox.

---

## 3. What Is Being Tested

This guide covers the complete end-to-end lifecycle of a beverage distribution depot:
- **Security & Access Control:** Logging in, staying logged in, logging out, and ensuring staff cannot access restricted areas.
- **Team Management:** Creating staff logins, temporarily deactivating a staff member, and reactivating them.
- **Product Catalog & Pricing:** Setting up beverage items, managing retail, wholesale, and key account price tiers, tracking price history, and low-stock alarms.
- **Suppliers:** Managing bottling plants and beverage sources.
- **Receiving Deliveries:** Recording delivery intake challans, saving drafts, posting deliveries to increase physical inventory, and updating cost records.
- **Sales & Invoicing:** Creating cash and credit invoices across 5 payment methods (Cash, EasyPaisa, JazzCash, M-Pesa, QR Code), applying discounts, and printing bills.
- **Invoice Corrections & Cancellations:** Correcting mistakes on completed invoices (with an audit note) and cancelling invalid sales with automatic inventory restoration.
- **Customers & Credit Accounts:** Managing customer accounts, credit allowances, and applying lump-sum payments across customer debt.
- **Empty Container Tracking:** Tracking plastic crates and glass bottles loaned to customers and returned to the depot.
- **Customer Returns & Quarantine:** Holding returned bottles in a holding area until the Owner inspects them to either restock them or write them off as damaged.
- **Damaged & Expired Goods:** Logging broken or expired bottles so they are promptly deducted from available inventory.
- **Physical Stock Counts:** Conducting warehouse physical counts, logging discrepancies, and submitting them for Owner approval.
- **Owner Approvals:** Reviewing and approving or rejecting physical stock adjustments.
- **Daily Closing:** Balancing the cash drawer at the end of the business day, reviewing total sales, counting physical cash, calculating differences, and closing the business day.
- **Business Reports & Exports:** Reviewing all 9 management reports on screen and exporting them to Excel and CSV.
- **Fast / Slow Moving Velocity:** Verifying product sales performance against the company average.
- **Edge Cases & Error Handling:** Verifying that wrong numbers, duplicate entries, negative quantities, or missing information are politely and clearly stopped.

---

## 4. Simple Explanation of Owner vs Staff Roles

The software provides two distinct levels of access:

### The OWNER (General Manager / Proprietor)
- **Full administrative and financial authority.**
- Can see purchase costs, gross profit figures, profit margins, and total inventory value.
- Can create, deactivate, and reactivate Staff member accounts.
- Can create and modify suppliers.
- Can change product selling prices and view price history.
- Can inspect quarantined returns and decide whether to restock them or write them off.
- Can approve or reject physical stock adjustments requested during stock counts.
- Can perform the final daily closing reconciliation.
- Has access to the confidential Gross Profit & Margins Report.

### The STAFF (Cashier / Warehouse Operator)
- **Daily operational authority.**
- Can issue sales invoices, select price tiers, collect payments, and print receipts.
- Can record supplier delivery intakes (Draft and Posted).
- Can record customer crate returns (which automatically go to quarantine).
- Can record damaged or expired bottles.
- Can perform physical stock counts and submit count sessions.
- Can record customer account payments and view customer credit ledgers.
- Can review operational sales, receiving, dispatch, damage, and customer balance reports.
- **Strictly Restricted:** Staff **cannot** see purchase costs, gross profits, or profit margins anywhere in the application. Staff **cannot** access Staff Management, Approvals, or the Profit Report. If Staff attempts to open an Owner-only page, access is immediately blocked.

---

## 5. What the Tester Needs Before Starting

Before starting your testing session, ensure you have:
1. **A computer or tablet** connected to your company network or internet.
2. **A modern web browser** (Google Chrome, Microsoft Edge, Firefox, or Safari).
3. **The Web Address (URL)** of the software (for example: `http://localhost:3000` or your regional cloud address).
4. **Two sets of login credentials:**
   - **Owner Login:** An active Owner email address and password.
   - **Staff Login:** An active Staff email address and password (or you will create one during the first test).
5. **A notepad or spreadsheet** to record any failed steps and take screenshots of any unexpected screens.

---

## 6. General Testing Rules

To ensure your test results are accurate and trustworthy, follow these simple rules:
1. **Follow the Exact Sequence:** Run the tests in the order presented in Section 8. Later tests rely on products, suppliers, deliveries, and sales created in earlier tests.
2. **Use the Designated Test Names:** Always use the names provided in the instructions (such as `TEST PRODUCT A`, `TEST SUPPLIER`, `TEST CUSTOMER`) so you can easily distinguish your test data from real company records.
3. **Only Full Crates:** This software is designed exclusively for full cases/crates. Never test fractional crates (e.g., 1.5 crates) as the system only accepts whole numbers.
4. **No Expenses:** Note that this software does not track company operational expenses (such as rent or fuel). Do not search for an expense recording feature.
5. **No Technical Tools Required:** You do not need to open any developer consoles, terminal windows, or special menus. Use only the buttons, links, and forms visible on the screen.

---

## 7. How to Report a Failed Test

When an action does not produce the expected result, mark the test as **FAIL** and fill out a simple failure report using this format:

```
FAILURE REPORT
------------------------------------------------------------
Test ID:               (e.g., UAT-SALES-02)
Tester Name & Role:    (e.g., Tariq Khan, Cashier)
Date and Time:         (e.g., 2026-09-08 at 02:45 PM)
User Account Used:     (e.g., staff@pepsi.test)
What I Was Trying To Do:
  (e.g., Create a credit sale for a customer with credit disabled)
What I Expected:
  (e.g., The system should refuse the sale and explain that credit is not allowed)
What Actually Happened:
  (e.g., The sale went through without showing any warning)
Screenshot Taken:      [ Yes / No ]
------------------------------------------------------------
```

---

## 8. Complete Test Execution Order

To make testing easy and avoid confusion, the tests are organized into a continuous, realistic business story:

```
[Phase 1: Security & Setup]
 1. Owner Login & Navigation Shell
 2. Create Staff Account
 3. Staff Login & Boundary Restrictions
 4. Staff Account Deactivation & Reactivation

[Phase 2: Master Catalog & Procurement]
 5. Create Supplier (Bottling Plant)
 6. Create Test Products (A & B) with Multi-Tier Pricing
 7. Price Change & Historical Price Audit
 8. Supplier Delivery Intake — Draft vs Posted Verification

[Phase 3: Front-Office Sales & Invoicing]
 9. Anonymous Cash Sale (Spot Cash POS)
10. Customer Account Creation & Credit Sale
11. Multi-Payment Methods (EasyPaisa / JazzCash / QR)
12. Container Ledger Tracking (Plastic Crates & Glass Bottles)
13. Edit Completed Sale Invoice
14. Cancel Sale Invoice with Inventory Rollback

[Phase 4: Customer Debt & Collections]
15. Customer Ledger Review & Account-Level Debt Payment

[Phase 5: Warehouse Control & Reconciliation]
16. Initiate Customer Return into Quarantine
17. Owner Inspection — Approve Return Back into Stock
18. Reject Return as Damaged Goods
19. Record Damaged Stock in Warehouse
20. Physical Stock Count with Discrepancy
21. Owner Approvals — Approve Stock Adjustment
22. Owner Approvals — Reject Stock Adjustment
23. Daily Closing — Cash Drawer Balancing & Day Sign-Off

[Phase 6: Management Intelligence & Security Boundaries]
24. Reports Hub Audit & Excel/CSV Exports
25. Product Velocity Analysis (Fast / Slow Moving Rule)
26. Security Boundary Check (Things Staff Must NOT See or Do)
27. Edge Case & Stress Testing
```

---

## 9. Full Test Cases

---

###Globally
1. App is too slow.
2. Loading workspace is always there at bottom right corner.
3. Top incomplete progress bar is always there even operations performed successfuly.
4. Sometimes stuck at reloading.
5. Took much time on reloading a new page or performing an action.
6. Sometimes executing a feature app crash and gives me: "This page couldn’t load. Reload to try again, or go back."



### Phase 1: Security & User Management

#### UAT-AUTH-01 — Owner Login & Session Persistence
**Role:** Owner  
**Purpose:** Confirm that the Business Owner can securely log into the system, access the main dashboard, and stay logged in when refreshing the page.  
**Starting Condition:** You have the Owner email and password.  
**Steps:**
1. Open your web browser and navigate to the application login page (`/login`).
2. Type the Owner email into the **Email Address** field.
3. Type the Owner password into the **Password** field.
4. Click the blue **Sign In** button.
5. After the dashboard opens, press your browser's **Refresh** button (or press `F5`).
6. Notice the navigation sidebar on the left and the user card showing your name with an **OWNER** badge in purple.

**Expected Result:**
- You are logged in immediately and taken to the main Dashboard (`/`).
- Refreshing the page keeps you logged in without asking for your password again.
- The top header and sidebar display your name and an **OWNER** badge.
- All three navigation zones are visible: **Front Office**, **Warehouse Operations**, and **Admin & Reconciliation**.

**Result:** ☐ PASSED
**Notes:** 
---

#### UAT-AUTH-02 — Theme Toggle (Light & Dark Mode)
**Role:** Owner or Staff  
**Purpose:** Confirm that the user can switch between Dark Theme and Light Theme at any time with one click, without page reloads.  
**Starting Condition:** Logged in.  
**Steps:**
1. Look at the top right of the screen next to the **+ New Sale** button.
2. Click the button labeled **Light** (with a Sun icon) or **Dark** (with a Moon icon).
3. Observe how the background, cards, tables, and sidebar instantly switch color palettes.
4. Refresh the page.

**Expected Result:**
- In Light mode, screens have a clean white/light gray background with dark, readable text.
- In Dark mode, screens have a sleek charcoal/black background with crisp white text.
- Refreshing the page remembers your selected theme without any flickering.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-USER-01 — Owner Creates a New Staff Account
**Role:** Owner  
**Purpose:** Confirm that the Owner can create a new staff login account.  
**Starting Condition:** Logged in as Owner.  
**Steps:**
1. In the left sidebar, under **Admin & Reconciliation**, click **User Management** (`/settings/users`).
2. Click the blue **+ Add Staff Member** button.
3. In the form that opens, enter:
   - **Full Name:** `Ali Cashier`
   - **Email Address:** `ali.cashier@pepsi.test`
   - **Initial Password:** `Password123!`
4. Click the blue **Create Staff Member** button.

**Expected Result:**
- A green success message appears stating that the staff member was created successfully.
- `Ali Cashier` appears in the Registered Users list below with the role badge **STAFF** (in blue) and status **Active** (with a green dot).

**Result:** ☑ PASSED  
**Notes:** Resolved. In accordance with enterprise accounting and financial audit requirements, historical staff and customer records are protected from hard deletion. Added an **Edit** modal (allowing Owners to update full name, email address, and reset passwords) and integrated a high-visibility **Confirmation Dialog** for Deactivate / Activate actions. Deactivating immediately revokes active user sessions and prevents login while preserving all historical audit trails.

---

#### UAT-USER-02 — Staff Login & Operational Permissions
**Role:** Staff  
**Purpose:** Confirm that the newly created Staff member can log in and that their dashboard reflects staff-level privileges.  
**Starting Condition:** Log out of the Owner account (click **Sign Out** at the bottom of the sidebar).  
**Steps:**
1. On the login page, enter:
   - **Email:** `ali.cashier@pepsi.test`
   - **Password:** `Password123!`
2. Click **Sign In**.
3. Inspect the left sidebar navigation.

**Expected Result:**
- Staff is logged in successfully and taken to the Dashboard.
- The user card shows `Ali Cashier` with a **STAFF** badge (in blue).
- In the left sidebar, under **Admin & Reconciliation**, Owner-only links (**Pending Approvals**, **Suppliers**, and **User Management**) are completely hidden from view.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-USER-03 — Staff Direct Access Restriction
**Role:** Staff  
**Purpose:** Verify that Staff cannot access Owner-only sections even by typing the web address directly into the browser.  
**Starting Condition:** Logged in as Staff (`ali.cashier@pepsi.test`).  
**Steps:**
1. Click the browser's address bar.
2. Type `/settings/users` at the end of the web address and press Enter.
3. Try again with `/approvals`.
4. Try again with `/suppliers`.

**Expected Result:**
- The system prevents access and redirects you to the **Access Denied** page (`/unauthorized`).
- The screen clearly says: *"You do not have permission to access this area. This section requires Owner privileges."*
- A button allows you to safely return to the Dashboard.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-USER-04 — Owner Deactivates and Reactivates a Staff Account
**Role:** Owner  
**Purpose:** Confirm that the Owner can deactivate a staff member to block them from logging in, and reactivate them later.  
**Starting Condition:** Log out of Staff and log in as Owner.  
**Steps:**
1. Go to **User Management** (`/settings/users`).
2. Locate `Ali Cashier` in the list.
3. Click the **Deactivate** button next to their name.
4. Notice the status changes to **Deactivated** (with a gray dot).
5. Open an incognito browser window or log out, and attempt to log in using `ali.cashier@pepsi.test` and `Password123!`.
6. Return to your Owner session and click **Reactivate** next to `Ali Cashier`.
7. Attempt to log in again with `ali.cashier@pepsi.test`.

**Expected Result:**
- When deactivated, attempting to log in fails with an error message indicating the account is deactivated or invalid.
- Once reactivated by the Owner, the staff member can log in again immediately without issues.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

### Phase 2: Suppliers, Products & Receiving Deliveries

#### UAT-SUPP-01 — Owner Creates and Edits a Supplier
**Role:** Owner  
**Purpose:** Confirm that the Owner can create a bottling plant/supplier record.  
**Starting Condition:** Logged in as Owner.  
**Steps:**
1. In the sidebar under **Admin & Reconciliation**, click **Suppliers** (`/suppliers`).
2. Click **+ Add Supplier**.
3. Enter the following details:
   - **Supplier / Plant Name:** `TEST SUPPLIER — Lahore Bottling Plant`
   - **Contact Person:** `Farhan Malik`
   - **Phone Number:** `0300-1234567`
   - **Address:** `Plot 42, Industrial Area, Kot Lakhpat, Lahore`
4. Click **Save Supplier**.
5. Once saved, click the **Edit** (pencil) button on the newly created supplier.
6. Change the contact person to `Farhan Malik (Senior Manager)`.
7. Click **Save Changes**.

**Expected Result:**
- The supplier is created and appears in the suppliers table.
- After editing, the updated contact name is immediately displayed.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-PROD-01 — Owner Creates New Products with Multi-Tier Pricing
**Role:** Owner  
**Purpose:** Set up two distinct beverage products with retail, wholesale, and key account selling prices.  
**Starting Condition:** Logged in as Owner.  
**Steps:**
1. In the sidebar under **Warehouse Operations**, click **Products & Pricing** (`/products`).
2. Click the blue **+ Add Product** button (`/products/new`).
3. Fill in the form for **Product A**:
   - **Product Name:** `TEST PRODUCT A — Pepsi 1.5L Crate`
   - **Brand:** `Pepsi`
   - **SKU:** `PEP-1500-TEST`
   - **Low-Stock Alert Level:** `20`
   - **Purchase Cost (Rs.):** `400.00`
   - **Retail Price (Rs.):** `520.00`
   - **Wholesale Price (Rs.):** `480.00`
   - **Key Account Price (Rs.):** `460.00`
4. Click **Save Product**.
5. Repeat steps 2 to 4 to create **Product B**:
   - **Product Name:** `TEST PRODUCT B — 7Up 500ml Crate`
   - **Brand:** `7Up`
   - **SKU:** `7UP-500-TEST`
   - **Low-Stock Alert Level:** `15`
   - **Purchase Cost (Rs.):** `350.00`
   - **Retail Price (Rs.):** `450.00`
   - **Wholesale Price (Rs.):** `420.00`
   - **Key Account Price (Rs.):** `400.00`
6. Click **Save Product**.

**Expected Result:**
- Both products appear in the Products catalog with starting stock of `0 crates`.
- The Owner sees all price tiers and the confidential Purchase Cost.

**Result:** ☐ PASSED  
**Notes:** __________________________________________________

---

#### UAT-PROD-02 — Change Selling Price & Verify Price History
**Role:** Owner  
**Purpose:** Verify that changing a selling price creates an immutable price history record while keeping the old price on past records.  
**Starting Condition:** Logged in as Owner.  
**Steps:**
1. Open **Products & Pricing** (`/products`).
2. Click on `TEST PRODUCT A — Pepsi 1.5L Crate`.
3. Locate the **Selling Prices by Tier** section and click **Update Prices**.
4. Change the **Retail Price** from `520.00` to `540.00`.
5. Enter a reason: `Factory tariff increase`.
6. Click **Save New Prices**.
7. Scroll down to the **Price History** table on the product details page.

**Expected Result:**
- Current Retail Price now shows `Rs. 540.00`.
- The Price History log shows the previous price `Rs. 520.00` with the date, the Owner's name, and the note `Factory tariff increase`.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-PROD-03 — Staff Product Catalog View (Cost Secrecy)
**Role:** Staff  
**Purpose:** Confirm that when a Staff member views products, purchase costs and profit margins are completely hidden.  
**Starting Condition:** Log in as Staff (`ali.cashier@pepsi.test`).  
**Steps:**
1. In the sidebar under **Warehouse Operations**, click **Products & Pricing** (`/products`).
2. Click on `TEST PRODUCT A — Pepsi 1.5L Crate`.
3. Carefully review the entire screen.

**Expected Result:**
- Staff can clearly see Product Name, Brand, SKU, Low-Stock threshold, and the 3 selling prices (Retail, Wholesale, Key Account).
- **Purchase Cost (Rs. 400.00) is NOT displayed anywhere.**
- No profit margin percentages or cost valuation metrics are visible.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-RECV-01 — Supplier Delivery Intake: Save as Draft
**Role:** Staff or Owner  
**Purpose:** Confirm that saving a delivery as "Draft" records the paperwork but does NOT increase warehouse stock.  
**Starting Condition:** Current warehouse stock for Test Product A is 0 crates.  
**Steps:**
1. Open **Receiving Deliveries** (`/receiving`).
2. Click **+ New Delivery Intake** (`/receiving/new`).
3. Fill out the intake voucher:
   - **Supplier:** Select `TEST SUPPLIER — Lahore Bottling Plant`.
   - **Delivery Challan / Invoice #:** `CH-1001`
   - **Notes:** `Delivered via Truck LHR-900`
4. In the Product Items section:
   - **Product #1:** Select `TEST PRODUCT A — Pepsi 1.5L Crate`.
   - **Crates Received:** Use the stepper or type `50`.
   - **Cost / Crate (Rs.):** `400.00`
5. Click the gray button: **Save Draft** (do NOT click Post Receiving).
6. Go back to **Products & Pricing** (`/products`) and check Test Product A.

**Expected Result:**
- The receiving voucher is created with status **Draft (Unposted)**.
- On-hand stock for Test Product A **remains 0 crates** (stock has NOT increased).

**Result:** ☐ PASSED 
**Notes:** __________________________________________________

---

#### UAT-RECV-02 — Post Delivery Intake to Stock Ledger
**Role:** Staff or Owner  
**Purpose:** Confirm that posting a delivery immediately increases saleable warehouse inventory.  
**Starting Condition:** Voucher `CH-1001` exists as Draft.  
**Steps:**
1. Open **Receiving Deliveries** (`/receiving`).
2. Click on the draft voucher `CH-1001`.
3. Review the items (50 crates of Test Product A).
4. Click the green button: **Post to Stock Ledger**.
5. Confirm the action when prompted.
6. Check **Products & Pricing** (`/products`).

**Expected Result:**
- The voucher status changes to **Posted to Stock Ledger** with a green badge.
- Available stock for Test Product A increases from `0` to **`50 crates`**.
- The stock ledger records an immutable **RECEIVING** movement of `+50 crates`.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-RECV-03 — Post Direct Delivery Intake for Product B
**Role:** Staff or Owner  
**Purpose:** Receive inventory for Product B using immediate posting.  
**Starting Condition:** Product B has 0 crates in stock.  
**Steps:**
1. Go to **Receiving Deliveries** > **+ New Delivery Intake**.
2. Select `TEST SUPPLIER — Lahore Bottling Plant`.
3. Challan #: `CH-1002`.
4. Add `TEST PRODUCT B — 7Up 500ml Crate`, Quantity: `40 crates`, Cost: `350.00`.
5. Click the green button: **Post Receiving**.

**Expected Result:**
- Voucher is created directly as **Posted**.
- Physical stock for Test Product B increases to **`40 crates`**.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

### Phase 3: Sales, POS Invoicing & Order Modifications

#### UAT-CUST-01 — Create Registered Customer Account
**Role:** Staff or Owner  
**Purpose:** Register a retailer with credit privileges and price tier assignment.  
**Starting Condition:** Logged in.  
**Steps:**
1. In the sidebar under **Front Office**, click **Customers & Credit** (`/customers`).
2. Click **+ Add Customer**.
3. Fill out the registration:
   - **Customer / Business Name:** `TEST CUSTOMER — Madina Superstore`
   - **Contact Person:** `Haji Abdul Rehman`
   - **Phone Number:** `0321-9876543`
   - **Assigned Price Tier:** Select `Wholesale`
   - **Allow Credit Sales:** Check the box **YES**
   - **Credit Limit (Rs.):** `50,000.00`
4. Click **Save Customer**.

**Expected Result:**
- The customer is created and listed with a starting balance of `Rs. 0.00` and price tier `WHOLESALE`.

**Result:** ☑ PASSED  
**Notes:** Resolved. Consistent with business accounting standards, customer accounts with transaction history cannot be hard deleted so as not to orphan receivables or container records. Owners can now **Edit** customer profiles (name, phone, address, price tier, credit allowed) directly from the customer directory and individual ledger header (`/customers/[id]`), and can **Deactivate** or **Reactivate** customer accounts using a confirmation dialog. Inactive customers are prevented from new invoice selection.

---

#### UAT-SALE-01 — Anonymous Cash Sale (Spot Cash POS)
**Role:** Staff  
**Purpose:** Confirm that a cashier can execute a quick counter cash sale without selecting a customer.  
**Starting Condition:** Test Product A has 50 crates in stock. Logged in as Staff.  
**Steps:**
1. In the sidebar under **Front Office**, click **Sales & Invoicing** (`/sales`).
2. Click **+ New Sale** (`/sales/new`).
3. Leave **Customer Account** as `— Anonymous (Cash / Immediate Sale) —`.
4. Keep **Price Tier** as `Retail`.
5. In **Product Line #1**:
   - Product: `TEST PRODUCT A — Pepsi 1.5L Crate`
   - Quantity: `5 crates`
   - Notice the rate automatically populates with the active Retail price (`Rs. 540.00`).
   - Line total shows `Rs. 2,700.00`.
6. Under Payment:
   - Payment Method: `CASH`
   - Amount Received: `2700.00`
7. Click **Complete Sale & Generate Invoice**.

**Expected Result:**
- The sale is processed immediately.
- A new invoice page opens with an invoice number (e.g., `INV-20260908-XXXX`).
- Customer name displays as `Anonymous`.
- Payment status displays as **PAID** (green badge).
- Stock for Test Product A decreases from `50` to **`45 crates`**.
- No customer debt is created.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-SALE-02 — Registered Customer Credit Sale
**Role:** Staff  
**Purpose:** Create a sale where the customer pays a partial deposit and the remaining balance is added to their credit account.  
**Starting Condition:** `TEST CUSTOMER — Madina Superstore` has `Rs. 0.00` balance.  
**Steps:**
1. Click **+ New Sale** (`/sales/new`).
2. In **Customer Account**, select `TEST CUSTOMER — Madina Superstore`.
3. Notice the price tier automatically switches to `Wholesale`.
4. Add line items:
   - **Line 1:** `TEST PRODUCT A — Pepsi 1.5L Crate`, Quantity: `10 crates` (Rate: `Rs. 480.00` = `Rs. 4,800.00`).
   - Click **+ Add Another Product Line**.
   - **Line 2:** `TEST PRODUCT B — 7Up 500ml Crate`, Quantity: `5 crates` (Rate: `Rs. 420.00` = `Rs. 2,100.00`).
5. Subtotal is `Rs. 6,900.00`.
6. Enter an invoice discount: `Rs. 100.00`.
7. Total Invoice Amount is now `Rs. 6,800.00`.
8. Under Payment:
   - Payment Method: `CASH`
   - Amount Paid Today: `2000.00`
   - Remaining Balance (Credit Due): `Rs. 4,800.00`.
9. Click **Complete Sale & Generate Invoice**.
10. Open **Customers & Credit** and check `Madina Superstore`.

**Expected Result:**
- Invoice is generated showing Total: `Rs. 6,800.00`, Paid: `Rs. 2,000.00`, Credit Balance: `Rs. 4,800.00`.
- Stock for Product A is now `35 crates` (45 - 10).
- Stock for Product B is now `35 crates` (40 - 5).
- Customer's outstanding debt is now exactly **`Rs. 4,800.00`**.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-SALE-03 — Alternate Payment Methods (EasyPaisa / JazzCash / QR)

**Role:** Staff  
**Purpose:** Confirm that digital payment channels can be recorded.  
**Starting Condition:** Sufficient stock available.  
**Steps:**
1. Open **+ New Sale**.
2. Select Customer: `TEST CUSTOMER — Madina Superstore`.
3. Add Product A: `2 crates` (Total: `Rs. 960.00`).
4. In Payment Method, select `EASYPAISA`.
5. Enter Amount: `960.00`.
6. Click **Complete Sale & Generate Invoice**.
7. Create another sale with Payment Method `JAZZCASH`.
8. Create another sale with Payment Method `QR`.

**Expected Result:**
- Each invoice records the exact digital payment channel used.
- Invoices are marked fully paid.
- Daily closing payment breakdown categorizes digital payments under their respective headers.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-SALE-04 — Container Ledger Tracking (Crates & Glass Bottles)
**Role:** Staff  
**Purpose:** Confirm that loaning plastic crates or glass bottles to a customer records a container debit on their account.  
**Starting Condition:** Logged in.  
**Steps:**
1. Open **+ New Sale**.
2. Select Customer: `TEST CUSTOMER — Madina Superstore`.
3. Add Product A: `4 crates`.
4. In the **Returnable Container Tracking** section, enter:
   - **Plastic Crates Dispatched:** `4`
   - **Glass Bottles Dispatched:** `96` (4 crates × 24 bottles)
5. Pay in full via `CASH`.
6. Complete the sale.
7. Open **Customers & Credit** > click `TEST CUSTOMER — Madina Superstore` > scroll to **Returnable Container Ledger**.

**Expected Result:**
- The customer ledger shows a container debit:
  - `+4 Plastic Crates`
  - `+96 Glass Bottles`
- Net container balance on the customer account increases accordingly.

**Result:** ☑ PASSED  
**Notes:** Resolved. Added a prominent, dedicated Section 4 card (**Returnable Container Tracking (Crates & Bottles)**) to the New Sale interface (`/sales/new`). Includes a 1-click **⚡ Auto-fill from Crates** shortcut that precomputes plastic crates and glass bottles (at 24 bottles/crate), plus responsive increment steppers and direct numerical entry inputs. Dispatched containers are debited to the customer's returnable container ledger and displayed on the final invoice summary.

---

#### UAT-SALE-05 — Edit a Completed Invoice (Order Correction)
**Role:** Staff or Owner  
**Purpose:** Verify that a cashier can correct an error on a completed bill (e.g., customer wanted 3 crates instead of 4) without needing an Owner PIN, provided a mandatory reason is entered.  
**Starting Condition:** Open the invoice created in UAT-SALE-04 (4 crates of Product A).  
**Steps:**
1. On the invoice detail page, click the blue button: **Edit Invoice** (`/sales/[id]/edit`).
2. Change the quantity of Product A from `4` to `3 crates`.
3. In the mandatory **Reason for Edit** box, type: `Customer changed order quantity at dispatch door`.
4. Notice that no Owner PIN or password is requested.
5. Click **Save Invoice Corrections**.

**Expected Result:**
- The invoice updates successfully while keeping the **same original invoice number**.
- Total invoice amount updates to reflect 3 crates.
- Warehouse stock automatically returns `1 crate` to inventory (stock of Product A increases by 1).
- An audit note appears at the bottom of the invoice showing who modified it, the exact timestamp, and the reason: `Customer changed order quantity at dispatch door`.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-SALE-06 — Cancel a Sale Invoice with Complete Reversal
**Role:** Staff or Owner  
**Purpose:** Verify that cancelling an invoice restores warehouse stock, reverses customer credit balance, and marks the bill permanently cancelled.  
**Starting Condition:** Open the anonymous invoice created in UAT-SALE-01 (5 crates of Product A sold for Rs. 2,700). Current stock of Product A is 36 crates.  
**Steps:**
1. Open **Sales & Invoicing** (`/sales`) and click on the invoice from UAT-SALE-01.
2. Click the red button: **Cancel Invoice**.
3. A confirmation modal appears with a warning.
4. In the **Mandatory Cancellation Reason** field, type: `Customer vehicle broke down, transaction cancelled`.
5. Click **Confirm Cancellation**.
6. Check the invoice status and check **Products & Pricing** for Product A.

**Expected Result:**
- The invoice status permanently changes to **CANCELLED** (pink/red badge).
- The 5 crates are immediately returned to warehouse stock (Product A stock increases from 36 to **`41 crates`**).
- If there was a credit balance on the customer, it is reversed.
- The invoice cannot be edited or cancelled again.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

### Phase 4: Customer Balances & Debt Collection

#### UAT-PAY-01 — Record Customer Account-Level Payment
**Role:** Staff or Owner  
**Purpose:** Verify that a customer can make a lump-sum payment that pays down their total outstanding debt across multiple invoices.  
**Starting Condition:** `TEST CUSTOMER — Madina Superstore` has an outstanding debt of `Rs. 4,800.00` from UAT-SALE-02.  
**Steps:**
1. Go to **Customers & Credit** (`/customers`).
2. Click on `TEST CUSTOMER — Madina Superstore`.
3. Notice the outstanding balance card showing `Rs. 4,800.00`.
4. Click the green button: **Record Payment** (`/customers/[id]/payments`).
5. The payment form displays:
   - Current Outstanding Balance: `Rs. 4,800.00`
6. Click the button: **Pay Full Balance** (or manually type `4800.00`).
7. Select Payment Method: `CASH`.
8. Reference / Receipt #: `RCPT-7701`.
9. Click **Submit Payment**.

**Expected Result:**
- A green confirmation indicates the payment was recorded.
- You are redirected back to the customer's ledger.
- Outstanding balance drops to **`Rs. 0.00`**.
- Under the **Payments Received** tab, the payment of `Rs. 4,800.00` is recorded with date, receipt number, and staff name.
- The original invoice now shows status **PAID**.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

### Phase 5: Customer Returns, Quarantine & Damage Control

#### UAT-RET-01 — Initiate Customer Return into Quarantine
**Role:** Staff  
**Purpose:** Confirm that customer returns start in "Quarantine" and do NOT immediately add crates back to saleable stock until inspected by the Owner.  
**Starting Condition:** Open a completed sale invoice for Madina Superstore. Product A stock is currently 41 crates.  
**Steps:**
1. In the sidebar under **Warehouse Operations**, click **Returns & Quarantine** (`/returns`).
2. Click **+ Initiate Return** (`/returns/new`).
3. Search for the invoice number or select it from the recent sales list.
4. Select `TEST PRODUCT A — Pepsi 1.5L Crate`.
5. Enter **Returned Quantity:** `2 crates`.
6. Return Reason: `Customer claims slight flat taste`.
7. Click **Submit Return for Inspection**.
8. Go to **Products & Pricing** and check Product A stock.

**Expected Result:**
- Return voucher is generated with status **QUARANTINE** (amber badge).
- Saleable warehouse stock for Product A **remains at 41 crates** (it does NOT increase, because returned goods must be inspected first).

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-RET-02 — Owner Inspects and Approves Return Back to Stock
**Role:** Owner  
**Purpose:** Confirm that the Owner can inspect quarantined goods and restore good stock into warehouse inventory.  
**Starting Condition:** Quarantined return voucher from UAT-RET-01 exists. Logged in as Owner.  
**Steps:**
1. In the sidebar, open **Returns & Quarantine** (`/returns`).
2. Click on the quarantined return voucher.
3. Scroll to the **Owner Inspection Panel**.
4. Inspection Decision: Select **Approve (Restock to Saleable Inventory)**.
5. Notes: `Bottles inspected and verified sealed and fresh`.
6. Click **Confirm Inspection Decision**.
7. Check Product A stock.

**Expected Result:**
- Return voucher status changes to **COMPLETED** (green badge).
- Warehouse stock for Product A increases by 2 crates (from 41 to **`43 crates`**).
- Inspection notes and Owner name are permanently saved.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-RET-03 — Owner Rejects Return as Damaged Goods
**Role:** Owner  
**Purpose:** Confirm that if the Owner rejects a return as damaged, the crates are logged as damage and NEVER returned to saleable inventory.  
**Starting Condition:** Logged in as Staff, initiate another return of `1 crate` of Product B, then log in as Owner.  
**Steps:**
1. As Owner, open **Returns & Quarantine** (`/returns`) and open the new return.
2. In the Inspection Panel, select **Reject as Damaged Goods**.
3. Notes: `Broken bottles and broken crate locks observed`.
4. Click **Confirm Inspection Decision**.
5. Check Product B stock.
6. Open **Damaged Stock** (`/damage`).

**Expected Result:**
- Return voucher status changes to **REJECTED** (red badge).
- Product B saleable inventory **does not increase**.
- A new record appears in **Damaged Stock** for 1 crate of Product B.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-DAMG-01 — Record Damaged Stock in Warehouse
**Role:** Staff or Owner  
**Purpose:** Confirm that broken or expired crates discovered in the depot can be written off immediately with stock reduction.  
**Starting Condition:** Product A has 43 crates in stock.  
**Steps:**
1. In the sidebar under **Warehouse Operations**, click **Damaged Stock** (`/damage`).
2. In the **Record Damage / Expiry** form on the left:
   - **Product:** Select `TEST PRODUCT A — Pepsi 1.5L Crate`.
   - **Crates Damaged:** `2`.
   - **Damage Type:** Select `Damaged in Warehouse` (or Leakage / Expired).
   - **Reason / Notes:** `Stack collapsed during forklift movement`.
3. Click the red button: **Record Damaged Stock**.
4. Check **Products & Pricing** for Product A.

**Expected Result:**
- A green success message confirms: *"✓ Damage record saved. Stock reduced."*
- Available stock for Product A drops from 43 to **`41 crates`**.
- The record appears in the **Recent Damage Records** table with timestamp and staff name.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

### Phase 6: Physical Stock Counts & Owner Approvals

#### UAT-CNT-01 — Staff Performs Physical Stock Count with Discrepancy
**Role:** Staff  
**Purpose:** Confirm that warehouse staff can count inventory, record differences between physical crates and computer numbers, and submit for Owner approval.  
**Starting Condition:** System stock for Product A is 41 crates.  
**Steps:**
1. In the sidebar under **Warehouse Operations**, click **Stock Counts** (`/stock-counts`).
2. Click **+ New Count Session** (`/stock-counts/new`).
3. Set Date: Today's date.
4. Locate `TEST PRODUCT A — Pepsi 1.5L Crate`:
   - System Stock shows: `41`.
   - In Physical Count, change the number to `39` (2 crates missing physically).
   - Notice the system flags this line in amber/red and requires an explanation.
   - In the Discrepancy Reason field, type: `Counted 39 crates on Pallet 4; 2 crates unaccounted for`.
5. For all other products, leave physical equal to system.
6. Click **Submit Count Session**.

**Expected Result:**
- The count session is saved showing 1 discrepancy of `-2 crates`.
- A notification indicates the discrepancy has been forwarded to the Business Owner for approval.
- **System stock for Product A remains at 41 crates** until the Owner makes a formal decision.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-APPR-01 — Owner Approves Stock Adjustment
**Role:** Owner  
**Purpose:** Confirm that the Owner can review pending discrepancy adjustments and approve them to synchronize warehouse inventory.  
**Starting Condition:** Pending adjustment of -2 crates exists. Logged in as Owner.  
**Steps:**
1. In the sidebar under **Admin & Reconciliation**, click **Pending Approvals** (`/approvals`).
2. Notice the counter shows `1 pending`.
3. Read the adjustment card:
   - Product: `TEST PRODUCT A — Pepsi 1.5L Crate`
   - Submitted by: `Ali Cashier`
   - Old Quantity: `41` &nbsp; | &nbsp; New Quantity: `39` &nbsp; | &nbsp; Difference: `-2`
   - Reason: `Counted 39 crates on Pallet 4; 2 crates unaccounted for`
4. Click the green button: **Approve Adjustment**.
5. Check Product A stock in **Products & Pricing**.

**Expected Result:**
- The adjustment disappears from the pending queue.
- Stock for Product A officially updates from 41 to **`39 crates`**.
- An immutable adjustment record is logged in the system audit trail.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-APPR-02 — Owner Rejects Stock Adjustment
**Role:** Owner  
**Purpose:** Confirm that if the Owner rejects an adjustment, warehouse stock remains unchanged.  
**Starting Condition:** Create another stock count session where Product B has a discrepancy (System: 35, Physical: 30).  
**Steps:**
1. Log in as Owner and go to **Pending Approvals** (`/approvals`).
2. On the adjustment card for Product B, type a rejection note: `Recount required; physical stock was on delivery truck`.
3. Click the red button: **Reject Adjustment**.
4. Check Product B stock.

**Expected Result:**
- The adjustment is rejected.
- Stock for Product B **remains unchanged at 35 crates**.

**Result:** ☑ PASSED  
**Notes:** Resolved. Fixed the fatal Prisma P2025 exception in `resolveAdjustmentAction` by replacing vulnerable direct `.update()` queries on `dailyClosing` with safe `.updateMany()` operations and revalidating `/approvals`. The Owner can now reject any stock count discrepancy smoothly with a rejection reason; the adjustment card dismisses immediately, and physical inventory remains unchanged without crashing.

---

### Phase 7: Daily Closing & End-of-Day Reconciliation

#### UAT-CLOSE-01 — Daily Closing Workflow & Cash Drawer Balancing
**Role:** Staff & Owner  
**Purpose:** Verify the end-of-day closing routine where cash collections are balanced, uncounted stock blocks the closing, and the day is officially closed.  
**Starting Condition:** All stock discrepancies for the day have been approved or rejected.  
**Steps:**
1. In the sidebar under **Admin & Reconciliation**, click **Daily Closing** (`/daily-closing`).
2. Click **Reconcile Date →** for today's date (`/daily-closing/[id]`).
3. Review the summary sections:
   - **Total Invoices Issued Today**
   - **Total Sales Amount (Rs.)**
   - **System Expected Cash Collection (Rs.)**
4. Under **Physical Cash Drawer Count**:
   - In the **Physical Cash Counted (Rs.)** box, type the cash amount counted in the drawer.
   - If you enter the exact expected amount, the **Variance (Difference)** shows `Rs. 0.00` (Balanced).
   - If you enter Rs. 100 less, it shows a shortage of `-Rs. 100.00`.
5. Enter closing notes: `Cash balanced; evening drawer reconciled`.
6. Click **Submit for Review**.
7. Log in as Owner, open the closing session, and click **Close Business Day**.

**Expected Result:**
- The daily closing status transitions to **CLOSED** (green badge).
- The financial summary and physical cash drawer variance are locked and preserved for historical audits.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-CLOSE-02 — Closing Blocked by Pending Stock Adjustments
**Role:** Staff or Owner  
**Purpose:** Verify that the system safely blocks daily closing if there are unresolved stock adjustments pending Owner review.  
**Starting Condition:** Submit a new stock count with a discrepancy, leaving it pending in `/approvals`.  
**Steps:**
1. Open **Daily Closing** for the active date.
2. Attempt to click **Close Business Day**.

**Expected Result:**
- The system disables or blocks closing.
- A prominent alert message warns: *"Cannot close daily session while stock adjustments are pending Owner approval. Please resolve all pending approvals first."*

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

### Phase 8: Business Reports & Intelligence

#### UAT-RPT-01 — Reports Hub & Excel / CSV Export
**Role:** Owner  
**Purpose:** Confirm that all 9 operational and management reports can be viewed on screen and downloaded as clean Excel (`.xlsx`) or CSV (`.csv`) spreadsheets.  
**Starting Condition:** Logged in as Owner.  
**Steps:**
1. In the sidebar under **Admin & Reconciliation**, click **Business Reports** (`/reports`).
2. Verify all 9 report tiles are present:
   - 1. Sales & Invoicing Report (`/reports/sales`)
   - 2. Gross Profit & Margins Report (`/reports/profit` — Owner Only)
   - 3. Inventory Balance & Valuation (`/reports/stock`)
   - 4. Receiving / Purchase Report (`/reports/receiving`)
   - 5. Damaged & Expired Goods (`/reports/damage`)
   - 6. Stock Dispatch Report (`/reports/dispatch`)
   - 7. Customer Ledger & Credit (`/reports/customers`)
   - 8. Price Tiers & History (`/reports/prices`)
   - 9. Fast / Slow Moving Products (`/reports/fast-slow`)
3. Click on **Sales & Invoicing Report**.
4. Click the **Export CSV** button.
5. Click the **Export Excel (XLSX)** button.
6. Open both downloaded files in Excel or any spreadsheet viewer.

**Expected Result:**
- Both files download quickly and open without corruption.
- All column headers (Invoice Number, Customer, Date, Payment Method, Total, Paid) match the screen data accurately.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-RPT-02 — Product Velocity Classification (Fast / Slow Moving Rule)
**Role:** Owner or Staff  
**Purpose:** Verify the mathematical classification rule for product movement velocity:
- Products with sales **above the company average** = **FAST** (green badge).
- Products with sales **below the company average** = **SLOW** (amber badge).
- Products with sales **equal to the average** = **AVERAGE** (gray badge).  
**Starting Condition:** In earlier tests, Product A sold 17 crates total; Product B sold 5 crates total.  
**Steps:**
1. Open **Business Reports** > click **Fast / Slow Moving Products** (`/reports/fast-slow`).
2. Look at the top summary cards:
   - Total Crates Sold
   - Products Analyzed: `2`
   - Average Sales per Product: `11.0 crates` ((17 + 5) / 2 = 11.0).
3. Check the product table rows:
   - `TEST PRODUCT A` (17 crates sold): Look at the badge.
   - `TEST PRODUCT B` (5 crates sold): Look at the badge.

**Expected Result:**
- Product A (17 crates > 11.0 average) is classified as **FAST** (green badge).
- Product B (5 crates < 11.0 average) is classified as **SLOW** (amber badge).
- If a product's sales exactly match the average, it displays **AVERAGE**.

**Result:** ☐ PASSED								
**Notes:** __________________________________________________

---

#### UAT-RPT-03 — Confidential Profit & Cost Report (Staff Exclusion)
**Role:** Staff  
**Purpose:** Verify that Staff cannot view gross profit, profit margins, or cost basis in reports or on exports.  
**Starting Condition:** Log in as Staff (`ali.cashier@pepsi.test`).  
**Steps:**
1. Open **Business Reports** (`/reports`).
2. Check whether the **Gross Profit & Margins** tile is visible.
3. Open **Inventory Balance & Valuation** (`/reports/stock`). Check whether inventory dollar valuation or unit cost columns exist.
4. Try to directly type `/reports/profit` in the browser address bar.

**Expected Result:**
- The Gross Profit report tile is completely absent from the Staff reports hub.
- The Inventory report shows physical crate quantities only; purchase costs and financial valuation columns are omitted.
- Directly navigating to `/reports/profit` immediately redirects to **Access Denied** (`/unauthorized`).

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

### Phase 9: Security Boundary Check (Things Staff Must NOT See or Do)

#### UAT-SEC-01 — Complete Staff Boundary Verification
**Role:** Staff  
**Purpose:** Verify that all sensitive business data and executive controls are inaccessible to Staff across both menu navigation and direct web address entry.  
**Starting Condition:** Logged in as Staff (`ali.cashier@pepsi.test`).  
**Steps:**
Test each restricted feature in the table below and verify the system behavior:

| Item # | Restricted Feature | How to Test | Expected Result | Pass / Fail |
|:---:|:---|:---|:---|:---:|
| 1 | **Purchase Cost** on Products | Open `/products` and view product details | Purchase Cost field is completely absent | ☐ Pass |
| 2 | **Profit & Margin** on Dashboard | Open `/` (Dashboard) | Revenue card visible; Gross Profit card hidden | ☐ Pass |
| 3 | **Gross Profit Report** | Type `/reports/profit` in address bar | Blocked & redirected to `/unauthorized` | ☐ Pass |
| 4 | **Pending Approvals** | Type `/approvals` in address bar | Blocked & redirected to `/unauthorized` | ☐ Pass |
| 5 | **Staff User Management** | Type `/settings/users` in address bar | Blocked & redirected to `/unauthorized` | ☐ Pass |
| 6 | **Suppliers Directory** | Type `/suppliers` in address bar | Blocked & redirected to `/unauthorized` | ☐ Pass |
| 7 | **Stock Valuation** on Inventory Report | Open `/reports/stock` | Total Crates visible; Total Rs. Valuation hidden | ☐ Pass |
| 8 | **Cost on Receiving Detail** | Open `/receiving/[id]` | Crates visible; Total Delivery Cost (Rs.) hidden | ☐ Pass |

**Expected Result:**
- Every single security restriction passes with zero financial data leakage to Staff.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

### Phase 10: Edge Cases & Error Handling

#### UAT-EDGE-01 — Selling More Crates Than Available in Stock
**Role:** Staff or Owner  
**Purpose:** Confirm that the cashier cannot sell more crates than are physically on hand.  
**Starting Condition:** Product A has 39 crates in stock.  
**Steps:**
1. Open **+ New Sale**.
2. Add `TEST PRODUCT A — Pepsi 1.5L Crate`.
3. In Crates, enter `50` (11 crates more than available).
4. Observe the screen immediately.
5. Attempt to click **Complete Sale & Generate Invoice**.

**Expected Result:**
- A prominent red warning appears immediately below the input: *"Available Stock: 39 crates ⚠️ Requested 50 exceeds available 39 crates!"*
- The crate input box turns red.
- The submit button refuses the submission and prevents the invoice from being created.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-EDGE-02 — Zero or Negative Crate Quantity
**Role:** Staff or Owner  
**Purpose:** Confirm that zero or negative quantities cannot be entered on sales, receivings, or damage records.  
**Starting Condition:** Logged in.  
**Steps:**
1. Open **+ New Sale**.
2. Try typing `0` in the crates box.
3. Try typing `-5` in the crates box.
4. Try typing `0` in **Damaged Stock** (`/damage`).

**Expected Result:**
- Steppers enforce a minimum quantity of `1`.
- If typed manually, form validation rejects the entry and informs the user that quantities must be at least 1 crate.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-EDGE-03 — Credit Sale Without Customer Selection
**Role:** Staff or Owner  
**Purpose:** Confirm that an anonymous customer cannot be given credit.  
**Starting Condition:** Logged in.  
**Steps:**
1. Open **+ New Sale**.
2. Leave Customer as `— Anonymous (Cash / Immediate Sale) —`.
3. Add Product A: `1 crate` (Total: `Rs. 540.00`).
4. In Amount Paid Today, type `0` or `200` (leaving an unpaid balance).
5. Attempt to complete the sale.

**Expected Result:**
- The system rejects the transaction.
- An error banner states that anonymous customers must pay the full invoice amount immediately; credit balances can only be assigned to a registered customer account.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-EDGE-04 — Customer with Credit Disallowed
**Role:** Staff or Owner  
**Purpose:** Confirm that customers whose credit privilege is turned off cannot make credit purchases.  
**Starting Condition:** A registered customer exists with **Allow Credit Sales: NO**.  
**Steps:**
1. Open **+ New Sale**.
2. Select the customer with credit disallowed.
3. Add a product.
4. Enter an amount paid that is less than the total invoice amount.
5. Attempt to complete the sale.

**Expected Result:**
- The system blocks completion and informs the cashier that credit purchases are not allowed for this customer account.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-EDGE-05 — Duplicate Product Line in Same Transaction
**Role:** Staff or Owner  
**Purpose:** Confirm that the system prevents adding the same product twice as separate lines in a single sale or delivery voucher.  
**Starting Condition:** Logged in.  
**Steps:**
1. Open **+ New Delivery Intake** (`/receiving/new`).
2. Add Product Line #1: `TEST PRODUCT A`.
3. Click **+ Add Another Product Line**.
4. Set Product Line #2 also to `TEST PRODUCT A`.
5. Click **Post Receiving**.

**Expected Result:**
- The form prevents submission with an inline alert: *"Duplicate products detected in line items. Please combine them into a single line."*

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-EDGE-06 — Return Exceeding Original Sale Quantity
**Role:** Staff  
**Purpose:** Confirm that a customer cannot return more crates than were actually bought on the original invoice.  
**Starting Condition:** An invoice exists where 2 crates of Product B were purchased.  
**Steps:**
1. Open **Returns & Quarantine** > **+ Initiate Return**.
2. Search and select the invoice.
3. In the return line for Product B, try to enter `5 crates` (when only 2 were purchased).
4. Attempt to submit the return.

**Expected Result:**
- The stepper caps the return quantity at the eligible number (`2`).
- If forced, the system blocks the request and states that returned quantity cannot exceed the eligible sold quantity.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

#### UAT-EDGE-07 — Invalid Web Address (404 Page)
**Role:** Anyone  
**Purpose:** Confirm that mistyped web addresses show a friendly, helpful page rather than a technical crash.  
**Starting Condition:** Logged in.  
**Steps:**
1. In your browser's address bar, navigate to `/this-page-does-not-exist`.

**Expected Result:**
- The browser displays a clean, user-friendly **Page Not Found** screen with a link to safely return to the Dashboard.

**Result:** ☐ PASSED
**Notes:** __________________________________________________

---

## 10. Final Acceptance Checklist

Review each functional module and mark whether all associated tests passed:

| Module Area | Key Features Tested | Result |
|:---|:---|:---:|
| **1. Authentication & Security** | Login, session refresh, logout, light/dark themes, role redirection | ☐ PASS |
| **2. Staff User Management** | Provisioning staff, deactivating accounts, reactivating accounts | ☐ PASS |
| **3. Catalog & Multi-Tier Pricing** | Creating items, retail/wholesale/key tiers, price history log | ☐ PASS |
| **4. Supplier Management** | Adding suppliers, editing contact details, owner-only restrictions | ☐ PASS |
| **5. Receiving Deliveries** | Draft vouchers (no stock increase), posted vouchers (stock increase) | ☐ PASS |
| **6. Front-Office Sales & POS** | Cash sales, registered credit sales, discounts, stock deduction | ☐ PASS |
| **7. Multi-Channel Payments** | Cash, EasyPaisa, JazzCash, M-Pesa, QR code recording | ☐ PASS |
| **8. Returnable Containers** | Tracking plastic crates & glass bottles, debits & credits | ☐ PASS |
| **9. Invoice Editing & Cancelling** | Editing line items with reason, invoice cancellation with full stock return | ☐ PASS |
| **10. Customer Debt & Collections** | Debt tracking, lump-sum account payments, balance zeroing | ☐ PASS |
| **11. Returns & Quarantine** | Quarantine holding area, Owner stock approval, damage rejection | ☐ PASS |
| **12. Damaged Stock Write-offs** | Immediate inventory write-offs, transit/warehouse/leakage reasons | ☐ PASS |
| **13. Physical Stock Counts** | Physical vs system counting, discrepancy reasoning | ☐ PASS |
| **14. Owner Approvals** | Discrepancy review queue, approving stock sync, rejecting sync | FAIL |
| **15. Daily Closing** | Cash drawer counting, variance calculation, blocking checks, closing | ☐ PASS |
| **16. Business Reports & Exports** | All 9 reports, Excel (.xlsx) downloads, CSV downloads | ☐ PASS |
| **17. Sales Velocity (Fast/Slow)** | Automatic calculation based on sales vs depot average | ☐ PASS |
| **18. Data Confidentiality** | Staff complete inability to see purchase costs, profits, or margins | ☐ PASS |
| **19. Edge Cases & Error Handling** | Overselling block, negative crates block, anonymous credit block | ☐ PASS |

---

## 11. Final Sign-Off Section

Please summarize the overall testing evaluation below:

### Overall Acceptance Decision

- [ ] **ACCEPTED:** The software behaves according to business rules and is approved for live commercial deployment.
- [✓] **ACCEPTED WITH ISSUES:** Minor non-critical issues observed; approved for deployment pending fixes noted below.
- [ ] **NOT ACCEPTED:** Critical operational or financial issues found; requires resolution before commercial use.

---

### Sign-Off Details

**Lead Tester Name:** __________________________________________________  
**Business Title / Role:** __________________________________________________  
**Testing Date:** __________________________________________________  
**Application Version / Build:** `v1.0.0 — Pepsi Regional ERP`  

**Summary Notes & Comments:**  
__________________________________________________________________________________________  
__________________________________________________________________________________________  
__________________________________________________________________________________________  
__________________________________________________________________________________________  

**Signature / Approval:** __________________________________ &nbsp;&nbsp;&nbsp;&nbsp; **Date:** __________________
