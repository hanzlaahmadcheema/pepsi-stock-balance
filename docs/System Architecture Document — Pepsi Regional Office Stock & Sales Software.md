# System Architecture Document
## Pepsi Regional Office Stock & Sales Software

### 1. Document Purpose

This document defines the technical architecture of the Pepsi Regional Office Stock & Sales Software.

It describes:

- Application structure
- Technology stack
- Database architecture
- Authentication
- User permissions
- Development and production environments
- Deployment process
- Security
- Data protection
- Notifications
- Reporting and exports
- Backup and recovery
- Future scalability

The system is designed as a **cloud-based responsive web application** that can be accessed from a mobile phone, laptop, or desktop through the internet.

---

# 2. System Overview

The system will use a modern web application architecture.

```text
                    Internet
                       │
             ┌─────────┴─────────┐
             │                   │
        Mobile Device        Laptop/Desktop
             │                   │
             └─────────┬─────────┘
                       │
                       ▼
                ┌─────────────┐
                │   Vercel    │
                │  Next.js App│
                └──────┬──────┘
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
       Business Logic       Supabase Auth
             │
             ▼
          Prisma
             │
             ▼
      PostgreSQL Database
         (Supabase)
```

The application, authentication, business rules and database will be separated logically so that each part has a clear responsibility.

---

# 3. Technology Stack

| Layer | Technology |
|---|---|
| Application Framework | Next.js |
| Programming Language | TypeScript |
| UI | React |
| Styling | Tailwind CSS |
| Backend | Next.js Server-side APIs / Server Actions |
| Database | PostgreSQL |
| Database Platform | Supabase |
| ORM | Prisma |
| Authentication | Supabase Auth |
| Application Hosting | Vercel |
| Source Control | GitHub |
| Notifications | In-App Dashboard & Reports (External deferred per Decision 5) |
| Data Export | Excel / CSV |
| Application Type | Responsive Web App / PWA |

---

# 4. Frontend Architecture

The user interface will be built using **Next.js, React, TypeScript and Tailwind CSS**.

The frontend is responsible for:

- Dashboard
- Sales screens
- Stock screens
- Receiving screens
- Customer screens
- Returns
- Damaged/expired goods
- Pricing
- Cash closing
- Reports
- User-facing notifications
- Mobile and desktop layouts

The interface must be responsive so the same application can work on:

- Mobile phones
- Tablets
- Laptops
- Desktop computers

The frontend must never rely on hiding sensitive information alone for security.

For example, hiding purchase cost from a staff user's screen is not sufficient. The server must also prevent unauthorized users from receiving that information.

---

# 5. Application / Backend Architecture

Next.js will provide the application backend.

Business operations will be processed on the server.

Examples:

- Creating a sale
- Updating stock
- Recording receiving
- Processing returns
- Recording damage
- Updating customer balances
- Calculating profit
- Approving stock corrections
- Generating reports

The general request flow will be:

```text
User Action
    ↓
Next.js Application
    ↓
Authentication Check
    ↓
Permission Check
    ↓
Business Rule Validation
    ↓
Database Operation through Prisma
    ↓
Database
    ↓
Result returned to user
```

Business-critical calculations and permission checks must happen server-side.

---

# 6. Database Architecture

The primary database will be **PostgreSQL hosted through Supabase**.

PostgreSQL is appropriate because the application contains strongly related business information such as:

- Products
- Customers
- Sales
- Sale items
- Payments
- Stock movements
- Purchases/receiving
- Returns
- Damaged goods
- Prices
- Customer balances
- Container balances
- Users
- Approvals
- Audit history

The database will use relational relationships to maintain consistency between these records.

---

# 7. Prisma

**Prisma** will be used as the application's database access layer.

Prisma will provide:

- Database models
- Relationships
- Type-safe queries
- Database migrations
- Structured database access

Application code should interact with PostgreSQL through Prisma rather than directly constructing uncontrolled database queries.

---

# 8. Financial Data Handling

Money-related database fields must use an exact numeric representation.

Financial values such as:

- Purchase price
- Selling price
- Revenue
- Payment amounts
- Profit
- Stock value

should use PostgreSQL numeric/decimal types rather than floating-point values.

This prevents common rounding problems in financial calculations.

---

# 9. Stock Architecture

Stock will be treated as a series of business movements rather than only storing a manually editable number.

Conceptually:

```text
Receiving       → Stock +
Sales           → Stock -
Damage          → Stock -
Approved Return → Stock + / appropriate status
Adjustment      → Stock +/- after approval
```

The system should retain the underlying movement history so that the current stock position can be explained from previous transactions.

---

# 10. Transaction Integrity

Operations that affect multiple related records should be performed as one controlled database transaction where appropriate.

For example, when a sale is completed:

```text
Create Sale
    +
Create Sale Items
    +
Record Payment
    +
Reduce Stock
    +
Update Customer Balance (if credit)
```

These related changes should succeed together or fail together.

The system must avoid situations where a sale is recorded but stock is not reduced, or stock is reduced while the sale itself was not saved.

---

# 11. Authentication

Authentication will be handled through **Supabase Auth**.

Users will sign in through the application's authentication interface.

Authentication establishes:

- Who the user is
- Whether the account is active
- Which user account is performing an operation

Authentication and authorization are separate concepts.

```text
Authentication
"Who are you?"

Authorization
"What are you allowed to do?"
```

---

# 12. Authorization & Roles

The initial system will support role-based access.

### Owner / General Manager

Full access, including:

- Stock
- Sales
- Customers
- Prices
- Purchase costs
- Profit
- Reports
- Approvals
- Exports
- Management functions

### Staff / Cashier

Access to normal operational activities, while restricted from confidential management information.

Staff must not receive:

- Purchase costs
- Profit margins
- Owner-only profit reports

Authorization checks must be performed on the server.

---

# 13. Approval Architecture

Certain sensitive actions require approval.

The primary confirmed example is stock correction.

```text
Staff requests correction
        ↓
Manager PIN / approval
        ↓
Permission verified
        ↓
Correction applied
        ↓
Audit record created
```

The exact approval workflow for stock mismatches remains subject to the unresolved client requirement regarding **“3 owner approval.”**

---

# 14. Audit Trail

Important business changes should be traceable.

The audit system should be capable of recording information such as:

- User
- Action
- Record affected
- Previous value
- New value
- Reason
- Approver where applicable
- Date/time

Examples include:

- Stock corrections
- Invoice cancellations
- Invoice modifications
- Price changes
- Important customer balance changes
- Damaged-goods write-offs
- Approval actions

The audit history should not be casually editable by normal users.

---

# 15. Profit Calculation Architecture

The current business rule is:

```text
Gross Profit
=
Selling Price
−
Latest Purchase Price
```

The latest manually recorded purchase price for the product will be used for this calculation.

Profit information is restricted to authorized management users.

The system should keep purchase-price history rather than overwriting historical information without trace.

---

# 16. Environment Architecture

Development and production must be separated.

### Development

Used for:

- New features
- Testing
- Bug fixing
- Database experimentation
- Test data

### Production

Used for:

- Actual business operations
- Real customer data
- Real sales
- Real stock
- Real financial records

Production data must **not** be used casually for development or testing.

---

# 17. Environment Separation

The recommended structure is:

```text
GitHub
│
├── main
│      ↓
│   Production
│      ↓
│   Vercel Production
│      ↓
│   Supabase Production DB
│
└── feature/development branches
       ↓
    Preview / Development
       ↓
    Vercel Preview
       ↓
    Supabase Development DB
```

Development and production databases must have separate credentials.

Production secrets must never be committed to GitHub.

---

# 18. Git & Deployment Workflow

The standard development process will be:

```text
Create Feature Branch
        ↓
Develop
        ↓
Run Tests
        ↓
Deploy Preview
        ↓
Test Feature
        ↓
Review
        ↓
Merge to Main
        ↓
Production Deployment
```

Development should never happen directly against the live production environment.

Core principle:

> Development can break. Production must not.

---

# 19. Vercel Deployment

Vercel will host the Next.js application.

Vercel provides separate deployment environments suitable for:

- Production
- Preview deployments
- Development workflows

Each feature branch can be tested through a preview deployment before being merged into production.

The production deployment will use production environment variables and production database credentials.

---

# 20. Supabase Architecture

Supabase will provide:

- PostgreSQL database
- Authentication
- Database infrastructure

Separate Supabase projects/environments should be maintained for development and production.

Conceptually:

```text
Supabase Development
    ↓
Test Database
    ↓
Safe experimentation

Supabase Production
    ↓
Real Business Database
    ↓
Actual Stock / Sales / Financial Data
```

---

# 21. Environment Variables & Secrets

Sensitive values must be stored as environment variables.

Examples include:

- Database connection information
- Supabase credentials
- Authentication configuration
- Notification service credentials
- Email credentials
- WhatsApp integration credentials

Secrets must:

- Never be committed to GitHub
- Never be hardcoded into source code
- Be separated between development and production

---

# 22. Notifications (Decision 5 resolved)

Automated external notifications (WhatsApp / Email) and instant external alert triggers are **deferred / skipped for now**.
- No `NotificationLog` table or external integration.
- Daily Closing Summary and low-stock alerts are viewed directly on-screen within the web application.

---

# 23. Reporting Architecture

Reports will be generated from the database using controlled server-side queries.

Required reports include:

### Sales

- Daily Sales & Revenue Summary

### Stock

- Stock In / Receiving
- Stock Out / Dispatch
- Current Stock on Hand
- Stock Value
- Low Stock Re-Order Alert
- Fast-Moving vs Slow-Moving Items

### Pricing

- Price History

### Profit

- Profit / Margin Report

### Customers

- Outstanding Balance
- Aging Ledger

### Damage

- Damaged / Expired Goods Write-off

### Cash & Payments

- Daily Cash & Payments Collection Summary (reconciles cash and digital payments against physical drawer cash; expenses excluded per Decision 4)

Reports containing sensitive financial information must respect user permissions.

---

# 24. Data Export

The system will support:

- Excel export
- CSV export

Exports should respect the user's permissions.

For example, staff users must not be able to export confidential purchase-cost or profit information if they are not authorized to view it.

---

# 25. Low Stock Detection

Products will have a configured minimum stock level.

Example:

```text
Minimum Stock Level = 20 crates
```

When available stock falls below the configured threshold, the product should be identified as low stock.

The system will use this information for:

- Low-stock dashboard information
- Re-order report
- Applicable notifications once alert behavior is finalized

---

# 26. Data Consistency

The application must protect the consistency of business records.

Examples:

- A sale should not reduce stock twice.
- A cancelled sale should correctly reverse its stock effect.
- A credit sale should update the customer's outstanding balance.
- A payment should reduce the correct outstanding balance.
- A stock correction should require the required approval.
- A returned item should not automatically become saleable stock before inspection.

Business rules should be enforced centrally rather than duplicated inconsistently across screens.

---

# 27. Error Handling

The system should provide clear user-facing messages when an operation cannot be completed.

Examples:

- Insufficient stock
- Invalid quantity
- Unauthorized operation
- Approval required
- Invalid payment amount
- Invalid customer
- Database/service unavailable

Technical error details should not be exposed unnecessarily to normal users.

---

# 28. Security Architecture

The system should follow basic security principles:

### Authentication

Only authenticated users can access protected functionality.

### Authorization

Users can access only the operations allowed by their role.

### Server-side validation

Important business rules must be validated on the server.

### HTTPS

All production communication should use HTTPS.

### Secret protection

Credentials and API keys must remain outside source control.

### Database protection

Production database access must be restricted to authorized application/services.

### Auditability

Sensitive changes should have an audit history.

---

# 29. Backup & Recovery

The production database contains business-critical information.

Before major database changes:

```text
Backup
   ↓
Migration
   ↓
Verification
```

Database migrations must be tested in the development environment before being applied to production.

A recovery plan should be maintained for accidental data loss or failed database changes.

---

# 30. Database Migration Strategy

Database structure changes will be managed through Prisma migrations.

Recommended process:

```text
Change database design
        ↓
Create migration
        ↓
Apply to development database
        ↓
Test application
        ↓
Review migration
        ↓
Backup production
        ↓
Apply production migration
        ↓
Verify production
```

Production database changes should never be made casually through manual destructive operations.

---

# 31. Scalability

The initial system is intentionally sized for:

- 2–3 regular users
- Approximately 50–200 products
- One regional office

The architecture should still allow future expansion to:

- More users
- More products
- Larger transaction history
- Additional branches
- More detailed permissions
- Additional reports
- More advanced integrations

The initial implementation should not introduce unnecessary complexity for the current business size.

---

# 32. Free-Tier-Friendly Architecture

The initial deployment should minimize unnecessary infrastructure costs.

Primary services:

- GitHub for source control
- Vercel for application hosting
- Supabase for database and authentication
- Prisma for database access

The application should avoid introducing additional paid infrastructure unless the business actually requires it.

As usage grows, individual services can be upgraded independently.

---

# 33. Recommended Application Structure

A high-level project structure:

```text
Application
│
├── Authentication
│
├── Dashboard
│
├── Sales
│   ├── New Sale
│   ├── Sale History
│   └── Sale Corrections
│
├── Stock
│   ├── Current Stock
│   ├── Receiving
│   ├── Stock Movements
│   ├── Returns
│   ├── Damage / Expiry
│   └── Stock Adjustments
│
├── Products
│   ├── Product Catalog
│   ├── Prices
│   └── Price History
│
├── Customers
│   ├── Customer Accounts
│   ├── Credit
│   ├── Payments
│   └── Container Ledger
│
├── Cash Closing
│
├── Reports
│
├── Notifications
│
└── Administration
    ├── Users
    ├── Permissions
    ├── Approvals
    └── Audit History
```

This is a logical organization rather than a final implementation structure. The exact code structure can be finalized during development.

---

# 34. Core Data Flow

### Sale

```text
User
 ↓
Sales Screen
 ↓
Server Validation
 ↓
Permission Check
 ↓
Sale Transaction
 ├── Sale Record
 ├── Sale Items
 ├── Payment
 ├── Stock Movement
 └── Customer Balance (if credit)
 ↓
Database
```

### Receiving

```text
User
 ↓
Receiving Screen
 ↓
Validate Quantity & Purchase Cost
 ↓
Database Transaction
 ├── Receiving Record
 ├── Stock Movement
 └── Latest Purchase Price
 ↓
Database
```

### Stock Correction

```text
User
 ↓
Correction Request
 ↓
Manager Approval / PIN
 ↓
Validation
 ↓
Stock Movement
 ↓
Audit Record
 ↓
Database
```

---

# 35. System Reliability Principles

The application should prioritize:

1. Accurate stock
2. Accurate sales records
3. Accurate financial records
4. Controlled corrections
5. Clear permissions
6. Traceable changes
7. Safe deployments
8. Production data protection

The system should favor correctness over convenience when the two conflict.

---

# 36. Architecture Decision Summary

| Area | Decision |
|---|---|
| Application | Next.js |
| Language | TypeScript |
| UI | React + Tailwind CSS |
| Backend | Next.js server-side functionality |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Supabase Auth |
| Database Hosting | Supabase |
| Application Hosting | Vercel |
| Source Control | GitHub |
| Notifications | WhatsApp + Email |
| Export | Excel + CSV |
| Deployment | Vercel |
| Development DB | Separate Supabase environment |
| Production DB | Separate Supabase environment |
| Application Type | Responsive Web App / PWA |

---

# 37. Architecture Principles

The project will follow these principles:

### 1. Separate development from production

Real business data must be protected from development activity.

### 2. Business rules belong on the server

The browser must not be trusted to enforce critical business rules.

### 3. Sensitive information requires authorization

Purchase costs and profit information must be restricted to management.

### 4. Financial operations must be consistent

Related financial and stock changes should be handled together.

### 5. Important changes must be traceable

Stock and financial corrections should have an audit trail.

### 6. Keep the initial architecture simple

The business is small, so the system should not introduce unnecessary infrastructure.

### 7. Design for future growth

The architecture should allow the system to grow without requiring a complete rewrite.

---

# 38. Final Architecture

The final high-level architecture is:

```text
                         USERS
                           │
             ┌─────────────┴─────────────┐
             │                           │
          Mobile                    Laptop/Desktop
             │                           │
             └─────────────┬─────────────┘
                           │
                         HTTPS
                           │
                           ▼
                  ┌─────────────────┐
                  │     Vercel      │
                  │    Next.js      │
                  │                 │
                  │ React + UI      │
                  │ Server Logic    │
                  │ API / Actions   │
                  └───────┬─────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
          Supabase     Business    Reporting
            Auth         Rules       Logic
                          │
                          ▼
                       Prisma
                          │
                          ▼
                  ┌─────────────────┐
                  │    Supabase     │
                  │   PostgreSQL    │
                  │                 │
                  │ Business Data  │
                  │ Stock History  │
                  │ Sales          │
                  │ Customers      │
                  │ Financial Data │
                  │ Audit History  │
                  └─────────────────┘

                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
          WhatsApp                     Email
        Notifications               Notifications
```

This architecture provides a centralized cloud system where authorized users can manage stock, sales, customers and financial information from anywhere, while keeping production data protected and business-critical operations controlled.