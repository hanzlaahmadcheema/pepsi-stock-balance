# UI/UX & Screen Specification Document
## Pepsi Regional Office Stock & Sales Software

---

# 1. Document Purpose

This document defines the user interface and screen requirements for the Pepsi Regional Office Stock & Sales Software.

It describes:

- Main screens
- Information shown on each screen
- User actions
- Navigation
- Owner vs Staff visibility
- Forms
- Tables
- Reports
- Daily workflows
- Mobile and desktop behavior

The purpose is to make the software simple enough for daily operational use while giving the Owner/General Manager clear visibility into sales, stock and profitability.

---

# 2. UX Principles

The interface should follow these principles:

### Simple

Daily tasks should require as few steps as reasonably possible.

### Fast

Sales, stock entries and payments are frequent operations and should not require unnecessary navigation.

### Clear

Important information such as stock levels, sales totals and outstanding balances should be immediately understandable.

### Business-focused

The interface should use familiar business terms rather than technical terminology.

### Responsive

The application should work properly on:

- Mobile phones
- Tablets
- Laptops
- Desktop computers

### Permission-aware

Users should only see information and actions appropriate to their role.

---

# 3. User Roles

The initial interface supports two primary roles.

## Owner / General Manager

Full access to:

- Dashboard
- Sales
- Stock
- Products
- Customers
- Prices
- Profit
- Reports
- Approvals
- Daily closing
- Audit history
- Exports
- Management settings

## Staff / Cashier

Access to normal operational functions such as:

- Sales
- Payments
- Relevant stock operations
- Customer operations where authorized
- Daily operational tasks

Staff must not see:

- Purchase costs
- Profit margins
- Owner-only profit reports

---

# 4. Main Navigation

The application should provide a clear main navigation structure.

Recommended navigation:

```text
Dashboard
Sales
Stock
Products
Customers
Cash Closing
Reports
Approvals
Settings
```

Not every navigation item needs to be visible to every role.

For example:

```text
STAFF
├── Dashboard
├── Sales
├── Stock
├── Customers
└── Cash Closing

OWNER
├── Dashboard
├── Sales
├── Stock
├── Products
├── Customers
├── Cash Closing
├── Reports
├── Approvals
└── Settings
```

---

# 5. Login Screen

## Purpose

Allow authorized users to access the application.

## Elements

- Application name/logo
- Email/username field as supported by authentication
- Password field as supported by authentication
- Sign-in button
- Error message area

## Behavior

After successful authentication:

```text
Login
 ↓
Verify account
 ↓
Determine role
 ↓
Open Dashboard
```

Unauthorized or inactive users should not gain access to protected screens.

---

# 6. Dashboard

The Dashboard is the primary overview screen.

Its contents should differ depending on the user's role.

---

## 6.1 Owner Dashboard

The Owner Dashboard should provide an immediate view of the business.

### Key information

- Today's sales
- Today's revenue
- Gross profit/margin
- Current stock value
- Low-stock items
- Outstanding customer balance
- Cash/payment summary
- Recent sales
- Recent stock activity
- Daily closing status

### Example layout

```text
┌──────────────────────────────────────────────┐
│ Dashboard                                    │
├──────────┬──────────┬──────────┬─────────────┤
│ Sales    │ Revenue  │ Profit   │ Stock Value │
│ Today    │ Today    │ Today    │             │
├──────────┴──────────┴──────────┴─────────────┤
│ Low Stock Items                               │
├──────────────────────────────────────────────┤
│ Today's Sales                                │
├──────────────────────────────────────────────┤
│ Customer Outstanding       Daily Closing     │
└──────────────────────────────────────────────┘
```

The dashboard should prioritize information needed for daily decision-making.

---

## 6.2 Staff Dashboard

The Staff Dashboard should focus on operational information.

It should show relevant information such as:

- Today's sales
- Payment totals
- Sales activity
- Relevant stock information
- Low-stock operational information
- Daily closing status

It must not display:

- Purchase costs
- Profit amounts
- Profit margins

---

# 7. Sales Screen

The Sales screen is one of the most frequently used screens.

## Purpose

Allow staff to quickly create a sale.

## Main elements

- Customer selection
- Sale type
- Product search
- Product selection
- Quantity
- Unit price
- Sale items
- Total amount
- Payment method
- Amount paid
- Credit amount
- Save/complete sale button

Sale types:

- Retail
- Wholesale
- Key Account

Payment methods:

- Cash
- EasyPaisa
- JazzCash
- M-Pesa
- QR

---

# 8. New Sale Workflow

The interface should support:

```text
Select Customer
      ↓
Select Sale Type
      ↓
Search Product
      ↓
Add Quantity
      ↓
Review Items
      ↓
Review Total
      ↓
Select Payment Method
      ↓
Complete Sale
```

For a credit sale:

```text
Sale Total
   ↓
Amount Paid
   ↓
Remaining Amount
   ↓
Customer Outstanding Balance
```

---

# 9. Sale Confirmation

After completing a sale, the user should receive a clear confirmation.

The confirmation can show:

- Invoice number
- Customer
- Items
- Total
- Payment method
- Amount paid
- Credit amount where applicable

The interface should make it obvious that the sale has been successfully recorded.

---

# 10. Sales History

## Purpose

Allow authorized users to find previous sales.

## Information

- Invoice number
- Date/time
- Customer
- Sale type
- Total
- Payment status
- Status

## Actions

Depending on permissions:

- View sale
- Print/view invoice
- Modify sale
- Cancel sale

Staff access to modification/cancellation will follow the final approval rule.

---

# 11. Sale Details

The Sale Details screen should show:

- Invoice number
- Date/time
- Customer
- Sale type
- Products
- Quantities
- Selling prices
- Total
- Payment information
- Credit balance where applicable
- Current sale status

Purchase cost and profit should only be displayed to authorized Owner/Manager users.

---

# 12. Stock Dashboard

The Stock screen provides a current view of warehouse stock.

## Information

- Product
- Brand
- Current quantity
- Minimum stock level
- Stock status
- Stock value where authorized

Possible stock statuses:

```text
Normal
Low Stock
Out of Stock
```

---

# 13. Stock Search & Filtering

Users should be able to find products quickly.

Filters can include:

- Product name
- Brand
- Stock status
- Fast-moving/slow-moving classification where applicable

Search should be available on both mobile and desktop.

---

# 14. Stock Receiving Screen

## Purpose

Record goods received from the supplier.

## Fields

- Supplier
- Date
- Product
- Quantity
- Purchase price
- Reference number
- Notes

The user should be able to add multiple products to one receiving record.

### Workflow

```text
Select Supplier
      ↓
Add Products
      ↓
Enter Quantities
      ↓
Enter Purchase Prices
      ↓
Review
      ↓
Save Receiving
      ↓
Stock Updated
```

---

# 15. Receiving History

The receiving history screen should show:

- Date
- Supplier
- Reference
- Products/quantity
- Total purchase value
- Created by

Owner users can access purchase-cost information.

Staff visibility should follow the final permission rules.

---

# 16. Product Catalog

## Purpose

Manage the product list.

## Information

- Product name
- Brand
- Current selling price(s)
- Latest purchase price — Owner only
- Minimum stock level
- Active/inactive status

## Actions

Owner can:

- Add product
- Edit product
- Deactivate product
- Configure prices
- Configure minimum stock level
- View price history

---

# 17. Product Details

The Product Details screen should provide a complete view of one product.

Possible sections:

```text
Product Information
Current Prices
Stock
Receiving History
Sales History
Price History
Stock Movement History
```

Owner-only information should remain protected.

---

# 18. Price Management

## Purpose

Manage different selling price levels.

Price categories:

- Retail
- Wholesale
- Key Account

The screen should allow authorized users to:

- View current prices
- Change prices
- Set effective dates where required
- Review previous prices

---

# 19. Price History

The Price History screen should show:

- Product
- Price type
- Previous price
- New price
- Effective date
- Changed by

Historical prices should remain available for reference.

---

# 20. Customer List

## Purpose

Manage customers and their accounts.

## Information

- Customer name
- Phone
- Address
- Price type
- Credit status
- Outstanding balance
- Container balance

## Actions

Authorized users can:

- Add customer
- Edit customer
- View customer
- View sales
- View payments
- View outstanding balance
- View container ledger

---

# 21. Customer Details

The Customer Details screen should provide a complete account view.

### Sections

```text
Customer Information
Outstanding Balance
Credit Sales
Payment History
Aging
Container Ledger
Sales History
Returns
```

The Owner should be able to see the complete financial picture.

---

# 22. Customer Payment Screen

## Purpose

Record payments against outstanding customer balances.

## Fields

- Customer
- Outstanding amount
- Payment amount
- Payment method
- Reference number
- Date
- Notes

### Workflow

```text
Select Customer
      ↓
View Outstanding Balance
      ↓
Enter Payment
      ↓
Select Payment Method
      ↓
Save Payment
      ↓
Outstanding Balance Updated
```

---

# 23. Customer Aging Screen

The screen should allow the Owner to identify overdue balances.

Possible categories:

- Current
- 1–30 days
- 31–60 days
- 61–90 days
- 90+ days

The user should be able to select a customer and see the transactions contributing to the outstanding balance.

---

# 24. Customer Container Ledger

## Purpose

Track returnable:

- Glass bottles
- Plastic storage crates

The screen should show:

- Customer
- Container type
- Debit
- Credit
- Current balance
- Transaction history

### Example

```text
Container Type: Plastic Crate

Debit       Credit       Balance
+20         0            20
0           -10          10
+15         0            25
```

The exact presentation of positive/negative balances will follow the final business rule.

---

# 25. Returns Screen

## Purpose

Record returned goods.

## Fields

- Customer
- Date
- Product
- Quantity
- Reason
- Notes

The returned goods should initially be marked for inspection/quarantine.

### Workflow

```text
Return Received
      ↓
Record Return
      ↓
Quarantine
      ↓
Inspect
      ↓
Approve for Saleable Stock
          OR
Reject / Damage
```

---

# 26. Return Inspection Screen

Authorized users should be able to review quarantined returns.

Actions:

- Approve for saleable stock
- Reject
- Mark as damaged where appropriate
- Add notes
- Record inspection

Returned goods should not become saleable stock until the appropriate decision is recorded.

---

# 27. Damaged / Expired Goods Screen

## Purpose

Record products that cannot be sold because they are damaged or expired.

## Fields

- Product
- Quantity
- Type
- Reason
- Date
- Notes

Types:

- Damaged
- Expired

The action should update stock and create the corresponding write-off record.

---

# 28. Stock Adjustment Screen

## Purpose

Correct an incorrect physical/system stock quantity.

The screen should show:

- Product
- Current system quantity
- Physical quantity
- Difference
- Reason
- Requested by
- Approval status

### Workflow

```text
Select Product
      ↓
Enter Physical Quantity
      ↓
System Calculates Difference
      ↓
Enter Reason
      ↓
Request Correction
      ↓
Manager Approval
      ↓
Stock Updated
```

A normal staff user should not be able to bypass the approval requirement.

---

# 29. Approval Screen

The Owner/Manager should have a central location for pending approvals.

Possible approval categories:

- Stock adjustments
- Sale corrections
- Sale cancellations
- Other sensitive operations

Each approval item should show:

- Request type
- Requested by
- Date/time
- Record affected
- Reason
- Current value
- Proposed value

Actions:

- Approve
- Reject
- View details

The final approval rules will depend on unresolved client requirements.

---

# 30. Daily Stock Count Screen

At closing, authorized users should be able to record physical stock.

## Information

- Product
- System quantity
- Physical quantity
- Difference

The system should make discrepancies obvious.

Example:

```text
Product       System    Physical    Difference
Pepsi         100       98          -2
7Up Free      60        60           0
```

A discrepancy can then be investigated and, if required, sent for an approved stock adjustment.

---

# 31. Cash Closing Screen

## Purpose

Perform the end-of-day payment reconciliation.

The screen should show:

- Total sales
- Cash collected
- Digital payments
- Credit sales
- Expected cash
- Physical cash
- Difference
- Closing status

### Workflow

```text
Review Sales
      ↓
Review Payments
      ↓
Count Physical Cash
      ↓
Enter Physical Cash
      ↓
System Calculates Difference
      ↓
Review
      ↓
Close Day
```

---

# 32. Daily Closing Summary

After closing, the Owner should be able to view the daily summary.

It should include the important business figures:

- Total sales
- Revenue
- Gross profit/margin
- Stock summary
- Payment summary
- Customer credit information where relevant
- Stock discrepancies where relevant
- Closing status

This summary is also the basis for the automatic daily notification.

---

# 33. Reports Screen

The Reports screen should provide a central list of available reports.

Recommended categories:

```text
Sales
Stock
Pricing
Profit
Customers
Damage
Cash
Exports
```

The available reports should depend on the user's role.

---

# 34. Sales Reports

Required report:

### Daily Sales & Revenue Summary

Possible filters:

- Date
- Date range
- Customer
- Sale type
- Payment method

The report should show totals and supporting transaction details where appropriate.

---

# 35. Stock Reports

Required reports:

- Stock In / Receiving Report
- Stock Out / Dispatch Report
- Current Warehouse Stock
- Total Stock Value
- Low Stock Re-Order Alert Sheet
- Fast-Moving vs Slow-Moving Item Analysis

Filters should include relevant date/product options.

---

# 36. Profit Report

The Profit / Margin Report is Owner-only.

It should show information such as:

- Product
- Quantity sold
- Selling price
- Applicable purchase cost
- Gross profit
- Gross margin

The report must not be accessible to Staff.

---

# 37. Customer Reports

Required reports:

- Customer Outstanding Balance
- Aging Ledger

The Owner should be able to identify:

- Who owes money
- How much they owe
- How long the balance has been outstanding

---

# 38. Damage Report

Required report:

### Damaged / Expired Goods Write-off Log

It should include:

- Product
- Quantity
- Damage/expiry type
- Reason
- Date
- Recorded by

---

# 39. Cash Report

Required report:

### Daily Cash & Payments Collection Summary

Reconciles cash, mobile money, and credit collections against physical cash counted at daily closing.
*(Note: 'Daily Cash Collected vs Paid Expenses' was removed per Decision 4 since expenses are excluded from the software).*

---

# 40. Export Interface

Reports should provide export options where appropriate:

- Excel
- CSV

Example:

```text
[Filter] [View Report] [Export Excel] [Export CSV]
```

Export permissions must follow the same restrictions as on-screen reports.

---

# 41. Audit History Screen

The Owner should have access to important system activity.

The screen can show:

- Date/time
- User
- Action
- Record
- Previous value
- New value
- Reason
- Approval information

Example:

```text
Date       User       Action             Record
---------  ---------  -----------------  ----------
Sep 06     Staff      Stock correction   Pepsi
Sep 06     Manager    Approved           Pepsi
Sep 06     Staff      Sale modified      INV-1024
```

---

# 42. Notifications (Decision 5 resolved)

Automated external notifications (WhatsApp / Email) and instant alert messages are **deferred / skipped for now**.
- No external messaging integration.
- Daily Closing Summary and low-stock alerts are viewed directly on-screen within the application.

---

# 43. Settings

The Settings area should be restricted to authorized users.

Possible sections:

```text
Business Settings
Users
Roles & Permissions
Products
Price Configuration
Notifications
System Information
```

Settings should not contain unnecessary technical configuration exposed to normal business users.

---

# 44. Mobile UX

Because the application may be used from mobile phones, mobile layouts are important.

The mobile interface should prioritize:

- Sales
- Product search
- Customer search
- Stock lookup
- Payment entry
- Daily closing

Tables should adapt to smaller screens.

Instead of forcing large desktop tables onto mobile screens, records can be displayed as compact cards or horizontally scrollable tables where appropriate.

---

# 45. Desktop UX

On laptops/desktops, the application can use:

- Sidebar navigation
- Wider tables
- Multi-column forms
- Dashboard cards
- Side-by-side information panels

The same business workflow should remain consistent across devices.

---

# 46. Form Design Rules

Forms should:

- Clearly label every field
- Use sensible defaults
- Validate required information
- Show useful error messages
- Prevent invalid quantities
- Prevent unauthorized actions
- Clearly show calculated totals
- Ask for confirmation before destructive/sensitive actions

Important actions should provide clear success/failure feedback.

---

# 47. Confirmation Rules

Confirmation should be used for actions such as:

- Cancel sale
- Modify sensitive transaction
- Approve stock correction
- Reject returned goods
- Write off damaged goods
- Close the business day

The interface should clearly explain what will happen before the user confirms.

---

# 48. Search & Filtering

Search should be available where users are likely to deal with many records.

Important searchable records:

- Products
- Customers
- Sales/invoices
- Receiving records
- Stock movements
- Payments
- Reports

The initial product catalog is only approximately 50–200 products, so search should remain fast and simple rather than introducing unnecessarily complex filtering.

---

# 49. Empty States

Screens should provide useful messages when no data exists.

Examples:

```text
No sales recorded today.

No low-stock products.

No pending approvals.

No outstanding customer balance.

No returned goods awaiting inspection.
```

Empty screens should explain what the user can do next where appropriate.

---

# 50. Error States

Errors should be written in simple business language.

Examples:

Instead of:

> Database transaction failed.

Prefer:

> We couldn't save this sale. Please try again.

For authorization:

> You don't have permission to perform this action.

For approval:

> Manager approval is required before this stock can be changed.

Technical error details should be available to developers/logs, not unnecessarily exposed to business users.

---

# 51. Sensitive Information Display

Purchase cost and profit information must be protected at the interface level.

### Owner

Can see:

- Purchase cost
- Gross profit
- Margin
- Profit reports
- Stock value

### Staff

Cannot see:

- Purchase cost
- Gross profit
- Margin
- Owner-only profit reports

This restriction must be enforced by the backend as well as the interface.

---

# 52. Navigation Flow

The primary user flow is:

```text
Login
  ↓
Dashboard
  │
  ├── Sales
  │    ├── New Sale
  │    └── Sales History
  │
  ├── Stock
  │    ├── Current Stock
  │    ├── Receiving
  │    ├── Returns
  │    ├── Damage
  │    └── Adjustments
  │
  ├── Products
  │    ├── Product Catalog
  │    └── Prices
  │
  ├── Customers
  │    ├── Accounts
  │    ├── Payments
  │    └── Container Ledger
  │
  ├── Cash Closing
  │
  ├── Reports
  │
  └── Approvals
```

---

# 53. Core Daily User Journey

The typical operational day should feel like:

```text
Open Dashboard
      ↓
Record Sales
      ↓
Record Payments
      ↓
Record Receiving when goods arrive
      ↓
Record Returns / Damage
      ↓
Review Stock
      ↓
Perform Physical Stock Count
      ↓
Resolve/Request Corrections
      ↓
Balance Cash
      ↓
Close Day
      ↓
Owner Receives Summary
```

---

# 54. Screen Priority

Not all screens have equal importance.

## Highest Priority

1. Dashboard
2. New Sale
3. Sales History
4. Current Stock
5. Stock Receiving
6. Customer Account
7. Cash Closing
8. Daily Closing Summary

## Medium Priority

9. Product Management
10. Price Management
11. Returns
12. Damage/Expiry
13. Stock Adjustment
14. Customer Payments
15. Reports

## Management / Supporting

16. Approvals
17. Audit History
18. Settings
19. Notification Configuration

---

# 55. UI Information Hierarchy

The interface should prioritize:

### Level 1 — What needs attention now?

- Low stock
- Pending approval
- Cash difference
- Stock discrepancy
- Outstanding customer balances

### Level 2 — What happened today?

- Sales
- Revenue
- Payments
- Stock movements
- Returns
- Damage

### Level 3 — Historical analysis

- Price history
- Profit reports
- Fast/slow-moving products
- Customer aging
- Audit history

---

# 56. Resolved UI Decisions (Decisions 1–5 Locked)

The interface behavior is confirmed as follows:

### 1. Sales Quantity (Decision 1 resolved)
- Full crates/cases only with integer input validation. No fractional crates or bottle conversions.

### 2. Stock Mismatch Approval (Decision 2 resolved)
- Staff submits physical count discrepancies (`PENDING`). One Owner/Manager reviews and approves or rejects.

### 3. Automatic Alerts (Decision 5 resolved)
- External automated notifications/alerts are deferred. Low-stock visibility is built into the on-screen dashboard and reports.

### 4. Sale Correction Permissions (Decision 3 resolved)
- Staff/Cashiers have direct modify/cancel actions on invoices, requiring a mandatory reason. Every edit is logged to `AuditLog`.

### 5. Expense Entry (Decision 4 resolved)
- Expenses are completely excluded from the application. No expense screens or fields. Cash closing balances sales receipts against cash drawer.

---

# 57. Final UI/UX Structure

The application should provide a simple business workflow centered around:

```text
                    DASHBOARD
                        │
       ┌────────────────┼────────────────┐
       │                │                │
      SALES            STOCK          CUSTOMERS
       │                │                │
       │                ├── Receiving   ├── Credit
       │                ├── Returns    ├── Payments
       │                ├── Damage     └── Containers
       │                └── Adjustment
       │
       └───────────────┬────────────────┘
                       │
                 CASH CLOSING
                       │
                       ▼
                DAILY SUMMARY
                       │
                       ▼
                  OWNER REVIEW
```

The UI should make the most common daily tasks immediately accessible while keeping management functions and confidential financial information restricted.

---

# 58. Final Screen Inventory

| # | Screen | Owner | Staff |
|---|---|---:|---:|
| 1 | Login | Yes | Yes |
| 2 | Dashboard | Yes | Yes |
| 3 | New Sale | Yes | Yes |
| 4 | Sales History | Yes | Yes |
| 5 | Sale Details | Yes | Yes |
| 6 | Stock Dashboard | Yes | Yes |
| 7 | Stock Receiving | Yes | Authorized |
| 8 | Receiving History | Yes | Authorized |
| 9 | Product Catalog | Yes | Limited |
| 10 | Product Details | Yes | Limited |
| 11 | Price Management | Yes | Limited |
| 12 | Price History | Yes | Limited |
| 13 | Customer List | Yes | Authorized |
| 14 | Customer Details | Yes | Authorized |
| 15 | Customer Payments | Yes | Authorized |
| 16 | Customer Aging | Yes | Limited |
| 17 | Container Ledger | Yes | Authorized |
| 18 | Returns | Yes | Authorized |
| 19 | Return Inspection | Yes | Authorized |
| 20 | Damage / Expiry | Yes | Authorized |
| 21 | Stock Adjustment | Yes | Request |
| 22 | Approvals | Yes | No |
| 23 | Daily Stock Count | Yes | Authorized |
| 24 | Cash Closing | Yes | Authorized |
| 25 | Daily Closing Summary | Yes | Limited |
| 26 | Sales Reports | Yes | Limited |
| 27 | Stock Reports | Yes | Limited |
| 28 | Profit Report | Yes | No |
| 29 | Customer Reports | Yes | Limited |
| 30 | Damage Report | Yes | Limited |
| 31 | Cash Collection Report | Yes | Limited |
| 32 | Export | Yes | Permission-based |
| 33 | Audit History | Yes | No |
| 34 | Settings | Yes | No |

---

# 59. Final UX Goal

The software should ultimately make the Owner's main question easy to answer:

> **“What were today's sales and profit, and how much stock do we have?”**

For staff, the main goal is:

> **“Let me complete today's sales and stock work quickly and correctly.”**

For management, the goal is:

> **“Give me a reliable picture of the business without exposing unnecessary complexity.”**