# Role-Based Access Control (RBAC) Permissions Matrix
**Project:** Pepsi Regional Depot Stock Balance & Sales System  
**Last Updated:** September 23, 2026  
**Roles:** `STAFF` vs `OWNER`

---

## 1. Overview & Guiding Principles

The application enforces a dual-role authorization model designed for high operational autonomy on the depot floor, balanced with strict financial confidentiality and audit safety:

1. **Staff Autonomy for Operational Throughput**: Depot staff can execute daily warehouse workflows without bottlenecks—recording deliveries, conducting sales, printing receipts, taking stock counts, managing products, and updating selling prices.
2. **Confidentiality of Purchase Costs & Margins**: Purchase costs (`latestPurchasePrice`) and gross profit margins are strictly private to the Business Owner. Staff interfaces, API payloads, and database server actions redact or reject cost data.
3. **Owner Approval on Balance-Impacting Adjustments**: Destructive or ledger-altering operations (voiding sales, approving physical count discrepancies, finalizing return credits, approving daily closings, and modifying user accounts) require explicit Owner authorization.

---

## 2. Comprehensive Permissions Matrix

| Domain / Module | Action / Capability | Staff | Owner | Enforcement & Security Notes |
| :--- | :--- | :---: | :---: | :--- |
| **Products & Catalog** | View product catalog & stock levels | ✅ | ✅ | Available to all authenticated users |
| | View selling price tiers & price history ledger | ✅ | ✅ | Retail, Wholesale, Key Account tiers visible |
| | Create new products | ✅ | ✅ | Initial selling prices can be set by Staff |
| | Edit product attributes (Name, Brand, SKU, Min Stock) | ✅ | ✅ | Staff can maintain catalog naming & alerts |
| | Toggle product status (Active / Inactive) | ✅ | ✅ | Staff can deactivate discontinued lines |
| | Update selling price tiers | ✅ | ✅ | Immutable audit trail recorded with `createdById` |
| | **View purchase cost (`latestPurchasePrice`)** | ❌ | ✅ | **Redacted from query results & UI for Staff** |
| | **Set or edit purchase cost (`latestPurchasePrice`)** | ❌ | ✅ | **Ignored in server action if sent by Staff** |
| **Sales & Invoicing** | Create new sales orders (POS / Counter) | ✅ | ✅ | Automatically applies customer price tier |
| | View sales records & order details | ✅ | ✅ | Staff sees customer, items, and total billed |
| | Print 80mm thermal receipts & invoices | ✅ | ✅ | Directly formatted for ESC/POS 80mm printer |
| | **Edit existing completed sales** | ❌ | ✅ | Prevent unauthorized edits after issuance |
| | **Cancel / Void completed sales** | ❌ | ✅ | Enforced server-side with `requireRole(OWNER)` |
| **Customers & Receivables** | Add new customer profile | ✅ | ✅ | Sets credit limit & customer price tier |
| | View customer directory, ledger & balance | ✅ | ✅ | Transparent tracking of outstanding dues |
| | Record customer credit payments | ✅ | ✅ | Staff can record cash and bank collections |
| | **Edit customer details & credit terms** | ❌ | ✅ | Enforced server-side with `requireRole(OWNER)` |
| | **Deactivate customer accounts** | ❌ | ✅ | Enforced server-side with `requireRole(OWNER)` |
| **Stock Receiving (Factory)** | Record inward factory shipments | ✅ | ✅ | Increases physical inventory counts |
| | View shipment history & received crates | ✅ | ✅ | Verifies physical dispatch vs receipt |
| | **View purchase invoice costs on shipments** | ❌ | ✅ | Sensitive purchase costs hidden from depot staff |
| **Inventory & Audits** | Record damaged / broken crates & bottles | ✅ | ✅ | Adjusts inventory for breakages and leaks |
| | Initiate & submit physical stock counts | ✅ | ✅ | Full depot inventory audit counting |
| | **Approve stock count & post adjustments** | ❌ | ✅ | **Discrepancy write-offs require Owner sign-off** |
| **Returns (Empties & Goods)** | Create customer return receipt | ✅ | ✅ | Staff records returned empties/bottles |
| | View return records & details | ✅ | ✅ | Verified against original invoice |
| | **Approve / finalize return credit** | ❌ | ✅ | Credit notes require Owner approval |
| **Daily Closing** | Submit shift daily cash & stock closing | ✅ | ✅ | Staff submits shift counts at end-of-day |
| | View past daily closing reports | ✅ | ✅ | History visible for shift auditing |
| | **Approve / verify daily closing** | ❌ | ✅ | Financial reconciliation lock by Owner |
| | **Reopen a locked closing period** | ❌ | ✅ | Restricted to Owner |
| **Reports & Analytics** | Sales, Stock, Damage & Dispatch reports | ✅ | ✅ | Operational volume, crate, and unit metrics |
| | Customer Aging & Balance reports | ✅ | ✅ | Receivable collection tracking |
| | **Gross Profit & Margin Report** | ❌ | ✅ | **Restricted: Requires purchase costs** |
| | **Executive Dashboard (Revenue, Costs, Margin)** | ❌ | ✅ | Staff dashboard shows operational KPIs only |
| **System Administration** | Factory suppliers management | ❌ | ✅ | Managing factory supplier accounts |
| | Approvals center | ❌ | ✅ | Unified queue for stock counts & returns |
| | Sync quarantine & conflict resolution | ❌ | ✅ | Resolving distributed offline sync conflicts |
| | User management (Staff/Owner accounts & PINs) | ❌ | ✅ | Provisioning credentials & account active state |

---

## 3. Security Implementation Architecture

### 3.1 Server-Side Enforcement (Defense in Depth)
- **Role Verification**: Critical mutations strictly invoke `requireRole(Role.OWNER)` in Server Actions and route handlers. Client-side hiding alone is never relied upon.
- **Session Resolution**: Authenticated identity is verified via Supabase Auth JWT with local cookie fallback for offline resilience on the depot machine.
- **Cost Obfuscation**: In `getProductDetails`, `latestPurchasePrice` is omitted from the return payload unless `user.role === Role.OWNER`.
- **Audit Trails**: Ledger mutations record the actor ID (`createdById`, `approvedById`, `resolvedByUserId`) to ensure traceability.

### 3.2 Offline Depot PC Guarantees
- Both Staff and Owner roles are cached in the local PostgreSQL database (`User` table).
- Offline operations continue seamlessly with identical role enforcement without requiring active internet connectivity to Supabase.
