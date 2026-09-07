# Business Rules & Workflow Document
## Pepsi Regional Office Stock & Sales Software

### 1. Purpose

This document defines **how the business operates inside the software**.

It converts the client's requirements into clear business rules and workflows for:

- Stock receiving
- Sales and dispatch
- Customer returns
- Damaged and expired goods
- Pricing
- Credit sales
- Customer container balances
- Profit calculation
- Stock verification
- Cash closing
- Approvals and corrections
- Reports and daily summaries

---

# 2. User Roles & Permissions

## 2.1 Owner / General Manager

The Owner / General Manager has full control of the system.

The Owner / General Manager can:

- View all sales
- View all stock
- View stock value
- View purchase costs
- View profit and margins
- Manage prices
- Manage customers
- Manage stock
- Approve stock corrections
- Review damaged/expired goods
- Review outstanding customer balances
- View all reports
- Export reports
- Review daily closing summaries

## 2.2 Staff / Sales Cashier

Staff can perform normal daily operations such as:

- Record sales
- Record customer payments
- Process permitted sales corrections
- Record stock receiving where authorized
- Handle normal operational entries

Staff **must not see**:

- Purchase costs
- Profit margins
- Owner-only profit reports

---

# 3. Product & Stock Rules

## 3.1 Product Catalog

The system will support approximately **50–200 products**.

Each product should contain at least:

- Product name
- Brand
- Selling price(s)
- Latest purchase price
- Minimum stock level

Example:

- Pepsi Regular
- 7Up Free

## 3.2 Stock Unit

The business operates strictly with **full crates/cases as the stock and sales unit** (Decision 1 resolved):

- Products are stocked in crates/cases.
- Sales are made in crates/cases.
- Returns are in crates/cases.
- Damage/write-off is in crates/cases.
- Stock adjustments are in crates/cases.
- No individual bottle sales.
- No crate-to-bottle conversion.
- No fractional crate quantities.
- All stock-related product quantities are tracked as integer quantities.

---

# 4. Stock Receiving Workflow

Stock is received when existing stock runs low or additional stock is required.

### Workflow

**Goods arrive → Quantity checked → Receiving recorded → Purchase cost entered → Stock increased**

For each receiving entry, the system should record:

- Date
- Product
- Quantity received
- Supplier/purchase source where applicable
- Purchase cost
- Total purchase value

The purchase cost is entered **manually for each delivery**.

The latest recorded purchase cost becomes the basis for profit calculation.

---

# 5. Sales Workflow

The normal sales process is:

**Customer requests goods → Products selected → Applicable selling price used → Payment type selected → Sale saved → Stock reduced → Sale recorded**

The system must support:

- Retail sales (can be anonymous without a Customer record; no generic 'Walk-in' record created — Decision 6A resolved)
- Wholesale sales
- Key-account sales
- Credit sales (strictly requires an actual registered Customer record)
- Cash payments
- Mobile-money/QR payments

Supported mobile payment methods include:

- EasyPaisa
- JazzCash
- M-Pesa

---

# 6. Pricing Rules

The business uses multiple selling-price levels:

1. Wholesale
2. Retail
3. Key Account

The applicable price should be selected according to the customer's applicable price level.

There are currently **no promotional schemes**.

## Price History & Active Price Logic (Decision 6C resolved)

The system preserves full price history:
- Exactly one active price per Product + PriceTier at any given time (`effectiveTo` is null).
- When a new price is set, an application transaction sets `effectiveTo = now()` on the previous active price and inserts the new price record atomically.
- Historical prices remain immutable and preserved for audit and reporting.

---

# 7. Credit Sales & Customer Balances

Credit sales are allowed for registered customers where `creditAllowed = true`.

When a credit sale is made:

**Sale → Amount added to customer's outstanding balance**

When the customer makes a payment (Decision 6B resolved):

**Payment → Outstanding balance reduced**

- Account-level lump-sum payments are fully supported: a customer can make a single payment against their overall outstanding balance spanning multiple invoices (`saleId` is optional; `customerId` is required).
- The system does not force every payment to be tied to a single invoice.
- The system maintains running customer balances, payment history, and FIFO-based aging information for the **Customer Outstanding Balance & Aging Ledger** report.

---

# 8. Returns Workflow

Customers and delivery vans may return:

- Unsold goods
- Rejected goods

A returned item must **not automatically become available stock**.

### Workflow

**Return received → Return recorded → Goods quarantined → Goods inspected → Decision made**

After inspection, the goods can be classified appropriately, such as:

- Returned to saleable stock
- Rejected/damaged
- Other applicable status

The exact inspection decision rules can be finalized with the business.

---

# 9. Empty Container / Crate Ledger

Returnable glass bottles and plastic storage crates require customer-level tracking.

Each customer can have a running debit/credit balance.

### Basic workflow

**Container issued → Customer balance updated**

**Container returned → Customer balance updated**

The system should maintain the customer's current container balance and transaction history.

---

# 10. Damaged & Expired Goods

Damage is considered a frequent operational occurrence, particularly during rough transportation and loading.

The supplier does **not** replace or credit damaged goods.

Damaged or expired goods must therefore be recorded separately from normal saleable stock.

### Workflow

**Damage/expiry identified → Item recorded → Stock removed from saleable quantity → Write-off recorded**

The system must maintain a **Damaged / Expired Goods Write-off Log**.

The record should include:

- Product
- Quantity
- Date
- Reason
- Relevant transaction/reference
- Person recording the entry

---

# 11. Stock Calculation Rules

The system must maintain stock based on business transactions.

The basic stock movement is:

**Stock In**
- Receiving goods increases stock.

**Stock Out**
- Sales/dispatch decreases stock.

**Damage**
- Damaged goods decrease saleable stock.

**Return**
- Returned goods first enter quarantine/inspection and do not immediately increase saleable stock.

**Manual Adjustment**
- A stock correction can change stock only after the required approval.

Every important stock movement should remain traceable.

---

# 12. Daily Physical Stock Verification

At the end of each working day, physical warehouse stock is checked.

The business performs a daily count, with particular attention to key high-value and fast-moving products.

### Workflow

**Day ends → Physical stock counted → System stock compared → Difference identified → Difference reviewed**

If the physical quantity does not match the system quantity, the discrepancy must be investigated.

### Stock Mismatch Approval Rule (Decision 2 resolved)

- Any physical stock mismatch requires Owner/Manager approval.
- Only ONE Owner/Manager approval is required.
- Staff cannot directly change the stock quantity.
- The staff member records the physical count and submits the discrepancy request.
- Owner/Manager reviews and approves or rejects it.
- If approved, the system applies the stock adjustment.
- Record who requested it, who approved it, when, the old quantity, new quantity, difference, and reason.
- No 3-person approval and no quantity threshold.

---

# 13. Stock Correction / Adjustment

A wrong physical stock entry cannot simply be changed by staff.

### Workflow

**Incorrect stock entry identified → Correction requested → Manager PIN required → Approval → Stock corrected → Change recorded**

The system should maintain a history of important stock corrections, including:

- Previous quantity
- New quantity
- Reason
- Person requesting the correction
- Approving manager
- Date/time

---

# 14. Sales Correction Rules

### Confirmed Rule (Decision 3 resolved)

- Cashier/Staff can directly modify or cancel a saved/printed invoice.
- NO Owner/Manager approval or PIN is required.
- A reason is mandatory for every modification or cancellation.
- Every change must be recorded in the immutable `AuditLog`.
- Audit history must preserve who changed it, when, what changed, the previous values, the new values, and the reason.
- Stock and customer balance/payment effects must be corrected automatically and atomically.
- Historical records are not silently destroyed; revisions are fully traceable.
- The original invoice number represents the same business transaction throughout revisions.

---

# 15. Profit Calculation

The business wants to see gross profit margins.

The current profit rule is:

**Profit = Sale Price − Latest Purchase Price**

The purchase cost used for this calculation is the **latest manually recorded purchase price** for that product.

Example:

- Latest purchase price = Rs. 100
- Selling price = Rs. 130
- Gross profit = Rs. 30

Profit and cost information is **Owner-only**.

Staff/cashiers must not be able to see:

- Purchase cost
- Profit amount
- Profit margin

Daily operational expenses are treated separately from this product-level gross-profit calculation.

---

# 16. Cash & Payment Workflow

The business accepts:

- Physical cash
- EasyPaisa
- JazzCash
- M-Pesa
- QR/mobile payments where applicable

The cash drawer is balanced at the end of each working day.

### Daily closing workflow

**Sales completed → Payments recorded → Cash/payment totals calculated → Physical cash counted → System totals compared → Closing summary generated**

The closing process should show the relevant sales and payment totals for reconciliation.

---

# 17. Daily Expenses (Decision 4 resolved)

Expenses are **completely excluded** from this software:
- No Expense entity or table.
- No petty cash module.
- No expense approval workflow.
- No expense payments recorded against the cash drawer.
- Daily cash closing reconciles sales collections only (expected cash from sales vs physical cash counted).
- Expenses remain managed entirely outside this software.

---

# 18. Daily Closing Summary

At the end of the working day, the system produces an on-screen daily summary containing the important operational information.

The core business requirement is:

> Daily sale profit margin, sales, and in-stock stock summary.

The daily summary covers the key figures needed by the Owner/General Manager, including:

- Sales
- Revenue
- Gross profit/margin
- Current stock
- Important stock movements
- Relevant payment totals
- Physical cash discrepancy (if any)

*(Note: Automated external dispatch via WhatsApp/Email is deferred per Decision 5; the summary is viewed directly inside the application).*

---

# 19. Notifications & Alerts (Decision 5 resolved)

Automated external notifications and alerts are **deferred / skipped for now**:
- No automated WhatsApp or Email delivery.
- No real-time low-stock external alert triggers.
- No external alert messages for invoice modifications, cancellations, or stock discrepancies.
- Low-stock information is surfaced directly inside the application on the Dashboard and in the Low-Stock Re-Order Alert Sheet.

---

# 20. Reporting Rules

The system must provide the following reports.

## Sales & Revenue

- Daily Sales & Revenue Summary

## Stock

- Stock In / Receiving Report
- Stock Out / Dispatch Report
- Current Warehouse Stock on Hand
- Total Stock Value
- Low Stock Re-Order Alert Sheet
- Fast-Moving vs Slow-Moving Item Analysis

## Pricing

- Price History

## Profit

- Profit / Margin Report

This report is **Owner-only**.

## Customers

- Customer Outstanding Balance
- Aging Ledger

## Damaged Goods

- Damaged / Expired Goods Write-off Log

## Cash & Payments

- Daily Cash & Payment Collection Reconciliation (reconciles cash & digital payments received)
*(Note: 'Daily Cash Collected vs Paid Expenses' was removed per Decision 4 since expenses are excluded from software).*

## Export

Reports/data must be exportable to:

- Excel
- CSV

---

# 21. Important Business Records

The system should preserve the history of important business activities rather than only storing the current result.

Important records include:

- Sales
- Payments
- Stock receiving
- Stock movements
- Returns
- Damaged/expired goods
- Price changes
- Customer balances
- Container movements
- Stock corrections
- Approvals

This allows the Owner/General Manager to understand how the current figures were produced.

---

# 22. End-of-Day Overall Workflow

The complete daily operational flow is:

**1. Sales recorded throughout the day**

↓

**2. Payments recorded**

↓

**3. Stock automatically updated from business transactions**

↓

**4. Returns and damaged goods recorded separately**

↓

**5. Customer credit balances updated**

↓

**6. Physical warehouse stock counted**

↓

**7. Physical stock compared with system stock**

↓

**8. Differences investigated**

↓

**9. Required corrections approved**

↓

**10. Cash/payment totals balanced**

↓

**11. Daily sales, stock and profit figures calculated**

↓

**12. Daily closing summary generated**

↓

**13. Summary sent to Owner/General Manager**

---

# 23. Core Business Principles

The software should follow these principles:

### Principle 1 — Stock must be traceable

Every important increase or decrease in stock should have a business reason.

### Principle 2 — Profit uses the latest purchase cost

Gross profit is calculated using the latest recorded purchase price.

### Principle 3 — Staff cannot see confidential financial information

Purchase costs and profit margins are Owner-only information.

### Principle 4 — Corrections require control

Important stock corrections require manager approval.

### Principle 5 — Returns are not automatically saleable

Returned goods must first be inspected.

### Principle 6 — Damage is recorded separately

Damaged/expired goods are removed from saleable stock and recorded as write-offs.

### Principle 7 — Customer container balances are maintained separately

Returnable crates/bottles require a debit/credit ledger for each customer.

### Principle 8 — Daily closing is important

The system must help the business reconcile sales, payments and physical stock at the end of the day.

### Principle 9 — Historical records should remain available

Important changes and transactions should be traceable.

---

# 24. Resolved Business Decisions (Decisions 1–6 Locked)

The initial unresolved items and architectural choices have been fully clarified and locked:

| # | Business Rule | Locked Decision |
|---|---|---|
| 1 | Sales / Stock unit | **Full Crates/Cases Only**: Integer quantities across all entities. No individual bottles, no conversions, no fractional crates. |
| 2 | Stock mismatch approval | **Single Owner/Manager Approval**: Staff submits discrepancy; one Owner/Manager approves or rejects. No 3-person approval or quantity threshold. |
| 3 | Sales corrections | **Direct Staff Permission with Immutable AuditLog**: Cashiers can directly modify/cancel saved invoices with a mandatory reason. Auto-adjusts stock & balances atomically. |
| 4 | Daily expenses | **Completely Excluded**: No Expense table, no petty-cash module, no drawer expense payouts. Cash closing strictly reconciles sales collections. "Cash vs Expenses" report removed. |
| 5 | Automatic alerts | **Deferred / Skipped for Now**: No automated external notifications (WhatsApp/Email), no NotificationLog table, no external instant alerts. Low-stock alerts remain in-app only. |
| 6A | Walk-in Customers | **No Generic Account**: `Sale.customerId` is nullable. Retail/cash sales can be anonymous. Credit sales strictly require a registered Customer. |
| 6B | Customer Payments | **Account-Level Lump Sums Supported**: `Payment.saleId` is nullable. Payments can be made directly against a customer's overall balance (`customerId`) across multiple invoices. |
| 6C | Active Prices | **Application Transaction Logic**: Exactly one active price per Product + PriceTier (`effectiveTo` is null). Setting a new price atomically closes the previous active price. |

---

# 25. Final Business Workflow Summary

The software's central workflow is:

**Receive Goods → Maintain Stock → Sell Goods → Collect Payments → Track Credit → Handle Returns/Damage → Verify Physical Stock → Correct Approved Differences → Calculate Profit → Close Day → Send Owner Summary**

The primary objective is to give the Owner/General Manager a reliable daily view of:

**Sales + Revenue + Profit Margin + Stock on Hand + Payment Position**

while keeping sensitive purchase costs and profit information restricted to authorized management users.