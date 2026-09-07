# Database Design Document
## Pepsi Regional Office Stock & Sales Software

### 1. Purpose

This document defines the database structure for the Pepsi Regional Office Stock & Sales Software.

The database must reliably store and connect:

- Products
- Prices
- Suppliers and receiving records
- Stock movements
- Sales
- Payments
- Customers
- Credit balances
- Returns
- Damaged and expired goods
- Container balances
- Daily closing information
- User accounts and roles
- Approvals
- Audit history

The database will use **PostgreSQL**, hosted through **Supabase**, with **Prisma** used by the application to access the database.

---

# 2. Database Design Principles

The database will follow these principles:

1. **Keep business records separate from calculated information where appropriate.**
2. **Preserve transaction history instead of silently overwriting important records.**
3. **Use relationships between records to maintain consistency.**
4. **Use exact numeric types for money.**
5. **Restrict sensitive information through application authorization.**
6. **Maintain an audit trail for important changes.**
7. **Use database transactions for operations that modify multiple related records.**
8. **Keep development and production databases separate.**

---

# 3. High-Level Database Structure

```text
Users
  │
  ├── Roles
  └── Audit History
         
Products
  │
  ├── Prices
  ├── Receiving
  ├── Sales Items
  ├── Stock Movements
  ├── Returns
  └── Damage / Expiry

Customers
  │
  ├── Sales
  ├── Payments
  ├── Container Ledger
  └── Outstanding Balance

Sales
  │
  ├── Sale Items
  ├── Payments
  └── Stock Movements

Receiving
  │
  └── Stock Movements

Daily Closing
  │
  ├── Sales Summary
  ├── Payment Summary
  ├── Stock Verification
  └── Closing Summary
```

---

# 4. Core Entities

The initial database will contain the following primary entities:

| Entity | Purpose |
|---|---|
| User | System users |
| Role | User permission level |
| Product | Product catalog |
| Price | Current and historical prices |
| Customer | Customer accounts |
| Supplier | Source of received goods |
| Receiving | Goods received into the business |
| ReceivingItem | Products included in receiving |
| Sale | Sales/invoices |
| SaleItem | Products included in a sale |
| Payment | Payments received |
| StockMovement | Complete stock movement history |
| Return | Returned goods |
| ReturnItem | Products included in a return |
| DamageRecord | Damaged/expired goods |
| ContainerMovement | Customer container debit/credit history |
| StockAdjustment | Manual stock corrections |
| Approval | Approval records |
| DailyClosing | End-of-day closing |
| AuditLog | Important system-change history |

---

# 5. User & Role Tables

## 5.1 User

Stores application users.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| id | UUID | Unique user ID |
| authUserId | UUID | Supabase Auth user ID |
| name | Text | User name |
| roleId | UUID | User role |
| isActive | Boolean | Account status |
| createdAt | Timestamp | Creation date |
| updatedAt | Timestamp | Last update |

The actual password/authentication credentials will be managed by **Supabase Auth**, not stored as plain passwords in the application's database.

---

## 5.2 Role

Stores system roles.

Initial roles:

- OWNER
- STAFF

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| name | Enum/Text |
| description | Text |
| createdAt | Timestamp |

---

# 6. Product Tables

## 6.1 Product

Stores the product catalog.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| id | UUID | Product ID |
| name | Text | Product name |
| brand | Text | Brand |
| minimumStockLevel | Decimal | Low-stock threshold |
| latestPurchasePrice | Decimal | Current latest purchase cost |
| isActive | Boolean | Product status |
| createdAt | Timestamp | Creation date |
| updatedAt | Timestamp | Last update |

Example products:

- Pepsi Regular
- 7Up Free

The database should support approximately 50–200 products initially.

---

# 7. Price Architecture

## 7.1 Price

Prices should be stored separately from products so that price history can be preserved.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| productId | UUID |
| priceType | Enum |
| amount | Decimal |
| effectiveFrom | Timestamp |
| effectiveTo | Timestamp |
| createdBy | UUID |
| createdAt | Timestamp |

Initial price types:

- RETAIL
- WHOLESALE
- KEY_ACCOUNT

---

# 8. Purchase / Receiving Architecture

## 8.1 Supplier

A supplier record can identify where goods were purchased/received from.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| name | Text |
| contactName | Text |
| phone | Text |
| address | Text |
| isActive | Boolean |
| createdAt | Timestamp |
| updatedAt | Timestamp |

The exact supplier-management requirements can be expanded later if required.

---

## 8.2 Receiving

Represents one goods-receiving event.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| supplierId | UUID |
| receivedAt | Timestamp |
| referenceNumber | Text |
| notes | Text |
| createdBy | UUID |
| createdAt | Timestamp |

---

## 8.3 ReceivingItem

Stores products included in a receiving transaction.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| receivingId | UUID |
| productId | UUID |
| quantity | Decimal |
| purchasePrice | Decimal |
| totalCost | Decimal |

The purchase price is entered manually for each delivery.

The purchase price used for profit calculations can therefore be derived from the most recent applicable receiving record.

---

# 9. Stock Architecture

## 9.1 StockMovement

This is one of the most important database tables.

Rather than relying only on a manually editable stock number, the system should maintain a history of stock movements.

Suggested fields:

| Field | Type | Purpose |
|---|---|---|
| id | UUID | Movement ID |
| productId | UUID | Product |
| movementType | Enum | Movement reason |
| quantity | Decimal | Quantity changed |
| referenceType | Text/Enum | Related record |
| referenceId | UUID | Related record ID |
| createdBy | UUID | User |
| createdAt | Timestamp | Date/time |
| notes | Text | Additional information |

Possible movement types:

- RECEIVING
- SALE
- RETURN
- DAMAGE
- ADJUSTMENT

The exact treatment of returned goods will follow the inspection workflow.

---

# 10. Current Stock

Current stock can be calculated from stock movements.

Conceptually:

```text
Current Stock
=
Total Stock In
−
Total Stock Out
+
Applicable Approved Returns
±
Approved Adjustments
```

The system may maintain a cached/current-stock value for performance later, but the underlying movement history must remain available.

---

# 11. Sales Architecture

## 11.1 Sale

Represents the main sales/invoice record.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| invoiceNumber | Text |
| customerId | UUID |
| saleType | Enum |
| status | Enum |
| subtotal | Decimal |
| discount | Decimal |
| totalAmount | Decimal |
| paidAmount | Decimal |
| creditAmount | Decimal |
| soldAt | Timestamp |
| createdBy | UUID |
| updatedBy | UUID |
| createdAt | Timestamp |
| updatedAt | Timestamp |

Possible sale types:

- RETAIL
- WHOLESALE
- KEY_ACCOUNT

Possible statuses:

- COMPLETED
- CANCELLED

---

# 12. Sale Items

## 12.1 SaleItem

Stores individual products belonging to a sale.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| saleId | UUID |
| productId | UUID |
| quantity | Decimal |
| unitPrice | Decimal |
| totalAmount | Decimal |
| purchaseCostAtSale | Decimal |

The `purchaseCostAtSale` value is important because the latest purchase price may change later.

Storing the applicable cost at the time of the sale allows historical profit reporting to remain consistent.

However, the business currently defines profit using the latest purchase price. This field can support historical calculations if that business rule is later changed.

---

# 13. Payment Architecture

## 13.1 Payment

A sale may have one or more payment records.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| saleId | UUID |
| customerId | UUID |
| paymentMethod | Enum |
| amount | Decimal |
| referenceNumber | Text |
| paidAt | Timestamp |
| receivedBy | UUID |
| createdAt | Timestamp |

Payment methods:

- CASH
- EASYPAISA
- JAZZCASH
- MPESA
- QR

This structure allows the system to distinguish physical cash from digital payments.

---

# 14. Customer Architecture

## 14.1 Customer

Customer records are required for:

- Credit sales
- Outstanding balances
- Aging
- Container tracking
- Customer-specific business relationships

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| name | Text |
| phone | Text |
| address | Text |
| priceType | Enum |
| creditAllowed | Boolean |
| isActive | Boolean |
| createdAt | Timestamp |
| updatedAt | Timestamp |

The customer's price type can determine whether retail, wholesale or key-account pricing applies.

---

# 15. Customer Balance

The customer's outstanding balance should be derived from financial transactions.

Conceptually:

```text
Outstanding Balance
=
Credit Sales
−
Customer Payments
−
Applicable Credits/Adjustments
```

The database should preserve the underlying transactions instead of storing only one editable balance number.

---

# 16. Customer Aging

Customer aging can be calculated from unpaid credit sales.

Example categories:

```text
Current
1–30 Days
31–60 Days
61–90 Days
90+ Days
```

The exact aging periods can be adjusted if the business requires different categories.

---

# 17. Returns Architecture

## 17.1 Return

Represents a customer/delivery return.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| customerId | UUID |
| status | Enum |
| returnedAt | Timestamp |
| reason | Text |
| createdBy | UUID |
| inspectedBy | UUID |
| inspectedAt | Timestamp |
| notes | Text |

Possible statuses:

- QUARANTINED
- APPROVED_FOR_STOCK
- REJECTED
- COMPLETED

---

## 17.2 ReturnItem

Stores the products included in a return.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| returnId | UUID |
| productId | UUID |
| quantity | Decimal |
| inspectionResult | Enum |
| notes | Text |

Returned goods must not automatically increase saleable stock.

---

# 18. Damaged / Expired Goods

## 18.1 DamageRecord

Stores damaged or expired goods.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| productId | UUID |
| quantity | Decimal |
| damageType | Enum |
| reason | Text |
| referenceId | UUID |
| recordedBy | UUID |
| recordedAt | Timestamp |
| notes | Text |

Possible damage types:

- DAMAGED
- EXPIRED

Each damage record should generate the corresponding stock movement.

---

# 19. Container Ledger

## 19.1 ContainerMovement

Tracks returnable glass bottles and plastic storage crates by customer.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| customerId | UUID |
| containerType | Enum |
| movementType | Enum |
| quantity | Decimal |
| referenceId | UUID |
| createdBy | UUID |
| createdAt | Timestamp |
| notes | Text |

Possible container types:

- GLASS_BOTTLE
- PLASTIC_CRATE

Possible movement types:

- DEBIT
- CREDIT

Customer balance can be calculated as:

```text
Container Balance
=
Total Debit
−
Total Credit
```

The exact business interpretation of positive/negative balance should be standardized during implementation.

---

# 20. Stock Adjustment Architecture

## 20.1 StockAdjustment

Represents a manual correction to stock.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| productId | UUID |
| oldQuantity | Decimal |
| newQuantity | Decimal |
| difference | Decimal |
| reason | Text |
| requestedBy | UUID |
| status | Enum |
| approvedBy | UUID |
| approvedAt | Timestamp |
| createdAt | Timestamp |

Possible statuses:

- PENDING
- APPROVED
- REJECTED

A stock adjustment should generate a corresponding stock movement only after approval.

---

# 21. Approval Architecture

## 21.1 Approval

Stores approval decisions for sensitive actions.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| requestType | Enum |
| requestId | UUID |
| requestedBy | UUID |
| approvedBy | UUID |
| status | Enum |
| reason | Text |
| createdAt | Timestamp |
| approvedAt | Timestamp |

Possible request types include:

- STOCK_ADJUSTMENT
- SALE_CORRECTION
- SALE_CANCELLATION
- OTHER

The final list depends on the client's final approval rules.

---

# 22. Daily Closing

## 22.1 DailyClosing

Stores the end-of-day closing process.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| businessDate | Date |
| totalSales | Decimal |
| totalCash | Decimal |
| totalDigitalPayments | Decimal |
| totalCredit | Decimal |
| physicalCash | Decimal |
| cashDifference | Decimal |
| stockVerified | Boolean |
| status | Enum |
| closedBy | UUID |
| closedAt | Timestamp |

Cash closing reconciles sales and payment collections only against physical cash counted. Expenses are completely excluded per Decision 4.

---

# 23. Stock Verification

Daily physical stock verification can be represented through stock-count records.

## 23.1 StockCount

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| closingId | UUID |
| productId | UUID |
| systemQuantity | Decimal |
| physicalQuantity | Decimal |
| difference | Decimal |
| countedBy | UUID |
| countedAt | Timestamp |

A discrepancy can then lead to an adjustment request if required.

---

# 24. Audit Log

## 24.1 AuditLog

The audit log records important changes.

Suggested fields:

| Field | Type |
|---|---|
| id | UUID |
| userId | UUID |
| action | Text/Enum |
| entityType | Text |
| entityId | UUID |
| oldValues | JSON |
| newValues | JSON |
| reason | Text |
| createdAt | Timestamp |

Examples:

- Sale modified
- Sale cancelled
- Stock adjusted
- Price changed
- Damage recorded
- Approval completed
- Customer balance correction

The audit log should be append-oriented and protected from ordinary user modification.

---

# 25. Relationships

Important relationships include:

```text
User
 ├── Sales
 ├── Receiving
 ├── Payments
 ├── Stock Movements
 ├── Adjustments
 ├── Approvals
 └── Audit Logs

Product
 ├── Prices
 ├── Receiving Items
 ├── Sale Items
 ├── Stock Movements
 ├── Return Items
 ├── Damage Records
 └── Stock Counts

Customer
 ├── Sales
 ├── Payments
 ├── Returns
 └── Container Movements

Sale
 ├── Sale Items
 └── Payments

Receiving
 └── Receiving Items

Return
 └── Return Items

Daily Closing
 └── Stock Counts
```

---

# 26. Data Integrity Rules

The database/application must enforce the following principles.

### Product

A product should not be permanently deleted if it has historical transactions.

Instead, it should normally be marked inactive.

### Sales

A completed sale must have at least one sale item.

### Sale Items

A sale item must reference an existing product.

### Payments

A payment must reference a valid sale/customer relationship.

### Stock

Stock movements must reference a valid product.

### Adjustments

A manual stock adjustment must not become effective before required approval.

### Returns

Returned goods must pass through the inspection workflow before becoming saleable stock.

### Financial Records

Amounts must use exact decimal/numeric values.

---

# 27. Historical Data Rules

Historical business information must remain available.

The system should avoid destructive updates to records that affect:

- Sales
- Payments
- Purchase prices
- Selling prices
- Stock movements
- Customer balances
- Approvals

For example, changing today's product price must not rewrite yesterday's recorded sale price.

---

# 28. Indexing Strategy

Indexes should be added to fields frequently used for:

- Product lookup
- Customer lookup
- Invoice lookup
- Date-based reports
- Stock movement queries
- Customer outstanding calculations
- Payment history
- Audit history

Likely indexed fields include:

```text
Product.name
Product.isActive

Sale.invoiceNumber
Sale.customerId
Sale.soldAt
Sale.status

Payment.saleId
Payment.customerId
Payment.paidAt

StockMovement.productId
StockMovement.createdAt

Receiving.receivedAt

Customer.name
Customer.phone

AuditLog.userId
AuditLog.entityType
AuditLog.entityId
AuditLog.createdAt
```

Indexes will be finalized after observing actual query patterns.

---

# 29. Money & Quantity Types

## Money

All monetary values should use:

**PostgreSQL NUMERIC / Prisma Decimal**

Examples:

- Purchase price
- Selling price
- Revenue
- Payment
- Profit
- Stock value

Floating-point numbers should not be used for financial amounts.

## Quantity
 
All stock-related product quantities use:
 
**PostgreSQL INTEGER / Prisma Int**
 
Per Decision 1, the business operates strictly with **full crates/cases only**:
- No loose bottles
- No crate-to-bottle conversion
- No fractional quantities
- Whole crate integers across Product, ReceivingItem, SaleItem, StockMovement, ReturnItem, DamageRecord, StockAdjustment, and StockCount.

---

# 30. Soft Deletion

Important business records should generally not be physically deleted.

For products, customers and other master records, an `isActive` field can be used.

For transaction records:

```text
Instead of:
DELETE SALE

Use:
SALE.status = CANCELLED
```

This preserves historical information.

---

# 31. Database Transactions

Operations that modify multiple records must use database transactions.

### Example: Sale

```text
BEGIN TRANSACTION

Create Sale
Create Sale Items
Create Payment
Create Stock Movements
Update Customer Balance if applicable

COMMIT
```

If one critical operation fails, the transaction should roll back.

---

# 32. Database Security

Production database credentials must not be exposed to the frontend.

The intended architecture is:

```text
Browser
   ↓
Next.js Server
   ↓
Prisma
   ↓
PostgreSQL
```

The browser should not receive unrestricted database credentials.

Sensitive fields such as purchase costs must also be filtered according to user permissions.

---

# 33. Development vs Production Database

Two separate database environments are required.

### Development Database

Contains:

- Test users
- Test products
- Fake sales
- Fake customers
- Test stock

### Production Database

Contains:

- Real users
- Real products
- Real sales
- Real customers
- Real stock
- Real financial information

Production data must not be used for ordinary feature development.

---

# 34. Migration Strategy

Database schema changes will be managed using Prisma migrations.

```text
Modify Prisma Schema
        ↓
Generate Migration
        ↓
Apply to Development
        ↓
Test
        ↓
Review
        ↓
Backup Production
        ↓
Apply Production Migration
        ↓
Verify
```

Destructive migrations require additional review before production deployment.

---

# 35. Backup Strategy

The production database is business-critical.

Backups should be available before:

- Major schema migrations
- Large data changes
- Potentially destructive operations

Recovery procedures should be tested rather than assuming that a backup is usable.

---

# 36. Reporting Data Model

Reports should primarily be generated from transactional records.

Examples:

### Daily Sales

```text
Sale
+
SaleItem
+
Payment
```

### Current Stock

```text
StockMovement
grouped by Product
```

### Profit

```text
SaleItem
+
Applicable Purchase Price
```

### Customer Outstanding

```text
Credit Sales
−
Customer Payments
```

### Damage

```text
DamageRecord
+
StockMovement
```

This approach keeps reports connected to the underlying business records.

---

# 37. Database-to-Feature Mapping

| Feature | Main Tables |
|---|---|
| Product Catalog | Product |
| Price Management | Product, Price |
| Stock Receiving | Receiving, ReceivingItem, StockMovement |
| Sales | Sale, SaleItem, Payment, StockMovement |
| Credit Sales | Sale, Payment, Customer |
| Customer Ledger | Customer, Sale, Payment |
| Returns | Return, ReturnItem, StockMovement |
| Damage/Expiry | DamageRecord, StockMovement |
| Container Tracking | ContainerMovement |
| Stock Corrections | StockAdjustment, Approval, StockMovement |
| Daily Closing | DailyClosing, StockCount |
| Profit | SaleItem, Price/Receiving |
| Reports | Multiple transactional tables |
| Audit | AuditLog |
| Permissions | User, Role |

---

# 38. Resolved Database Decisions (Decisions 1–5 Locked)

The previously unresolved database decisions have now been formally clarified and locked:

## 38.1 Sales Unit (Decision 1 resolved)
- Full crates/cases only.
- PostgreSQL `INTEGER` / Prisma `Int` across all stock and product quantity fields.
- No loose bottles, no conversion factors, no fractional quantities.

## 38.2 Stock Mismatch Approval (Decision 2 resolved)
- Single Owner/Manager approval required.
- Staff submits discrepancy (`PENDING`); one Owner/Manager approves or rejects.
- No multi-signature 3-owner approval and no quantity threshold.
- Tracks `requestedById`, `approvedById`, `approvedAt`, `oldQuantity`, `newQuantity`, `difference`, `reason`.

## 38.3 Automatic Alerts & Notifications (Decision 5 resolved)
- Deferred / skipped for now.
- No `NotificationLog` entity or table.
- No external automated WhatsApp or Email dispatch.
- Low-stock information remains available in-app via the Dashboard and Low-Stock Re-Order Alert Sheet.

## 38.4 Sale Corrections (Decision 3 resolved)
- Cashier/Staff can directly modify or cancel saved invoices.
- No manager PIN or approval required.
- Mandatory reason required for every change.
- Recorded in immutable `AuditLog` (who, when, what, previous values, new values, reason).
- Stock movements and customer balances corrected automatically and atomically.
- Original invoice number preserved for transaction lifecycle.

## 38.5 Daily Expenses (Decision 4 resolved)
- Expenses are completely excluded from the software.
- No `Expense` entity or table, no petty-cash module, no register expense payouts.
- Daily cash closing strictly balances cash and digital collections against physical cash.
- "Cash vs Expenses" report removed.

## 38.6 Walk-in Customers (Decision 6A resolved)
- No generic "Walk-in Customer" account.
- `Sale.customerId` is nullable. Retail/cash sales can be anonymous.
- Credit sales strictly require an actual registered `Customer`.

## 38.7 Customer Payments (Decision 6B resolved)
- Account-level lump-sum payments are fully supported.
- `Payment.saleId` is nullable.
- `Payment.customerId` is used for account payments across multiple past invoices.

## 38.8 Active Price Logic (Decision 6C resolved)
- One active price per Product + PriceTier (`effectiveTo` is null).
- Enforced at the application transaction level: setting a new price atomically closes the previous active price by setting its `effectiveTo = now()`.
- No partial unique index or manual database migration needed.

---

# 39. Initial Entity Relationship Overview

```text
                    ┌─────────────┐
                    │    User     │
                    └──────┬──────┘
                           │
             ┌─────────────┼──────────────┐
             │             │              │
             ▼             ▼              ▼
           Sales       Receiving       AuditLog
             │             │
       ┌─────┴─────┐       │
       ▼           ▼       ▼
   SaleItem     Payment  ReceivingItem
       │                   │
       └────────┬──────────┘
                │
                ▼
           ┌─────────┐
           │ Product │
           └────┬────┘
                │
       ┌────────┼──────────┬───────────┐
       ▼        ▼          ▼           ▼
     Price   StockMove   Damage      ReturnItem
                                      │
                                      ▼
                                   Return
                                      │
                                      ▼
                                  Customer
                                      │
                          ┌───────────┴──────────┐
                          ▼                      ▼
                    ContainerMove             Payment
```

---

# 40. Final Database Architecture

The database will be centered around **Products, Customers, Transactions and Stock Movements**.

The most important principle is that the system should be able to answer:

> “Why is the stock, sales total, customer balance, or profit figure at this value?”

The answer should be traceable through the underlying transaction history.

The database therefore prioritizes:

**Accurate records → Controlled changes → Traceable history → Reliable reports**

---

# 41. Final Technology Decision

| Component | Technology |
|---|---|
| Database | PostgreSQL |
| Database Hosting | Supabase |
| ORM | Prisma |
| Authentication | Supabase Auth |
| Application | Next.js |
| Language | TypeScript |
| Production Hosting | Vercel |
| Source Control | GitHub |

The database design is intended to support the current 2–3 user / 50–200 product operation while remaining extensible for future growth.

# 42. Next Design Stage

Decisions 1–5 are locked:
- Integer quantities for full crates
- Single Owner/Manager approval for stock adjustments
- Cashier direct invoice modifications with mandatory reason and immutable AuditLog
- Complete exclusion of expenses
- Deferral of automated external notifications

The database design is ready for conversion into the final Prisma schema once authorized.