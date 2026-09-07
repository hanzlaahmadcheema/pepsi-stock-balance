# Technology Stack & Cloud Architecture
## Pepsi Regional Office Stock & Sales Software

### 1. Project Approach

The software will be a **cloud-based web application**.

The system must be accessible from:
- Mobile phones
- Laptops
- Desktop computers

The system will be accessible remotely through the internet rather than being restricted to a single office computer.

The initial system will be designed for approximately **2–3 regular users** and around **50–200 products/items**.

The architecture should remain cost-efficient and suitable for free-tier cloud services during the initial stage.

---

# 2. Selected Technology Stack

| Area | Technology |
|---|---|
| Frontend | Next.js |
| Programming Language | TypeScript |
| UI Styling | Tailwind CSS |
| Backend | Next.js Server-side APIs / Server Actions |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Supabase Auth |
| Database Hosting | Supabase |
| Application Hosting | Vercel |
| Source Control | GitHub |
| Notifications | In-App Dashboard & Reports (External deferred per Decision 5) |
| Data Export | Excel / CSV |
| Application Type | Responsive Web Application / PWA |

---

# 3. Frontend

## Next.js

Next.js will be used to build the main application.

It will provide:
- Dashboard
- Sales screens
- Stock management screens
- Product management
- Customer management
- Reports
- Owner-only financial information
- Mobile-friendly interface

The application will be responsive so that the same system can be used on both mobile and laptop/desktop screens.

## TypeScript

TypeScript will be used throughout the application.

It will help reduce errors when working with:
- Stock quantities
- Prices
- Sales
- Customer balances
- Financial calculations
- User permissions
- Database records

Because the system handles financial and inventory information, strong data typing is important.

## Tailwind CSS

Tailwind CSS will be used for the application's interface and responsive design.

---

# 4. Backend

The backend will initially be handled within the Next.js application using server-side functionality and APIs.

The backend will be responsible for business operations such as:

- Recording stock received
- Recording sales
- Updating stock
- Recording returns
- Recording damaged goods
- Managing customer balances
- Managing prices
- Calculating profit
- Processing stock adjustments
- Enforcing user permissions
- Generating reports

Important business rules will run on the server rather than relying on calculations performed only in the user's browser.

---

# 5. Database

## PostgreSQL

PostgreSQL will be the primary database.

This is particularly suitable because the system contains connected business records such as:

- Products
- Customers
- Stock
- Stock receiving
- Sales
- Returns
- Damaged goods
- Prices
- Customer balances
- Payments
- Users
- Approvals
- Reports

The system requires reliable relationships between these records.

PostgreSQL will also be used for financial values with appropriate decimal/numeric data types rather than relying on floating-point numbers for monetary calculations.

---

# 6. Database Management

## Prisma

Prisma will be used as the database ORM.

It will provide a structured way for the application to work with PostgreSQL.

Prisma will be responsible for:
- Database models
- Database queries
- Relationships
- Migrations
- Type-safe database access

Database structure changes will be handled through controlled migrations rather than manually modifying the production database.

---

# 7. Cloud Database & Authentication

## Supabase

Supabase will provide the cloud PostgreSQL database and authentication services.

It will provide:

- Cloud PostgreSQL database
- User authentication
- Database security
- Database management
- Cloud infrastructure

The initial system should be designed to operate within available free-tier limits where practical.

---

# 8. Application Hosting

## Vercel

The Next.js application will be deployed on Vercel.

Vercel will provide:
- Cloud hosting
- HTTPS
- Production deployment
- Preview deployments
- Automatic deployment from GitHub
- Global accessibility

The owner will be able to access the system remotely through the application's web address.

---

# 9. Source Code Management

## GitHub

GitHub will be used to store and manage the source code.

The project will use separate development and production workflows.

Example:

```text
GitHub
│
├── main
│      │
│      └── Production
│
└── feature/*
       │
       └── Development / Preview
```

Feature development should not directly modify the production application.

---

# 10. Development Environment

Development will use a separate environment from production.

Development may contain:
- Test users
- Fake products
- Fake sales
- Fake customers
- Test stock
- Test financial data

Production data must not be used casually for development or testing.

Developers should test new functionality in development before it reaches production.

---

# 11. Production Environment

Production will contain the actual business data.

Production will have separate:

- Database
- Authentication configuration
- Environment variables
- API credentials
- Application configuration

Production credentials must never be committed to GitHub.

Production should only receive tested changes.

---

# 12. Deployment Workflow

The development workflow will follow:

```text
Create Feature
      ↓
Development
      ↓
Testing
      ↓
Pull Request
      ↓
Review
      ↓
Merge
      ↓
Production Deployment
```

Vercel Preview Deployments can be used to test changes before they are released to production.

The production branch will be treated as the stable version of the software.

---

# 13. Financial Calculation Approach

Financial calculations will be handled carefully because the system contains:

- Purchase costs
- Selling prices
- Sales
- Profit margins
- Customer balances
- Cash collections
- Stock valuation

The client's current profit rule is:

```text
Sale Price
    − Latest Purchase Price
    = Profit
```

Financial calculations should use appropriate decimal/numeric values.

Money should not be stored or calculated using ordinary floating-point values where precision can be lost.

---

# 14. Stock Calculation Approach

Stock should be treated as the result of recorded stock movements rather than simply allowing unrestricted manual overwriting.

Main movements include:

```text
Stock Received
      ↓
   + Stock

Sale
      ↓
   - Stock

Damage
      ↓
   - Stock

Return
      ↓
Quarantine / Inspection
      ↓
Saleable or Rejected

Stock Adjustment
      ↓
Manager Approval
      ↓
   + / - Stock
```

This approach provides a history of how the current stock quantity was reached.

---

# 15. User Access & Permissions

The system will support restricted access.

The Owner / General Manager will have access to:

- Full system control
- Reports
- Purchase costs
- Profit
- Profit margins
- Stock information
- Sales information

Cashiers/sales staff must not be able to see:

- Purchase costs
- Profit
- Profit margins

Sensitive financial information must therefore be protected through server-side permission checks, not only by hiding buttons in the interface.

---

# 16. Approval & Audit Controls

Important changes should be controlled.

For example:

```text
Stock Count Change
       ↓
Manager PIN
       ↓
Approved
       ↓
Stock Updated
```

The system should maintain sufficient history for important stock and financial changes so that changes can be investigated when required.

---

# 17. Remote Access

Because the system is cloud-based, authorized users will be able to access it from:

```text
Office Laptop
       │
       ├── Internet ──► Cloud Application
       │
Mobile Phone
       │
       └── Internet ──► Cloud Application
```

No direct connection to the office computer should be required.

---

# 18. Notifications (Decision 5 resolved)

Automated external notifications (WhatsApp / Email) are **deferred / skipped for now**.
- No external notification infrastructure is required.
- Daily Closing Summary and low-stock alerts are viewed directly on-screen in the application.

---

# 19. Reports & Data Export

The application will generate business reports including:

- Daily Sales & Revenue
- Stock In / Receiving
- Stock Out / Dispatch
- Current Stock
- Stock Value
- Low Stock Alerts (in-app)
- Fast-Moving Items
- Slow-Moving Items
- Price History
- Owner-only Profit / Margin
- Customer Outstanding Balances
- Customer Aging
- Damaged / Expired Goods
- Daily Cash & Payments Collection Summary (expenses excluded per Decision 4)
- Excel / CSV Export

---

# 20. Security Principles

The system will follow these principles:

1. Production credentials must remain private.
2. Users must authenticate before accessing protected information.
3. User permissions must be enforced on the server.
4. Sensitive financial information must not be exposed to unauthorized users.
5. Development and production databases must remain separate.
6. Production data must not be used as ordinary test data.
7. Database changes should use controlled migrations.
8. Important stock/financial changes should have an audit history.
9. HTTPS will be used for application access.
10. Database access credentials must be stored as environment variables/secrets.

---

# 21. Backup & Recovery

The production database must have a backup/recovery strategy.

Before major database changes:

```text
Backup
  ↓
Migration
  ↓
Verification
```

The objective is to ensure that a software update does not result in permanent loss of business data.

---

# 22. Scalability

The initial system is small:

- 2–3 regular users
- 50–200 products

The selected architecture can nevertheless support future expansion without requiring a complete rewrite.

Potential future expansion can include:

- More users
- More branches/offices
- More products
- More customers
- Additional reports
- More notification types
- Additional payment methods
- Additional business workflows

---

# 23. Initial Cloud Cost Strategy

The initial development and deployment will prioritize free-tier services where they are sufficient.

Primary services:

```text
GitHub
   ↓
Source Code

Vercel
   ↓
Application Hosting

Supabase
   ↓
PostgreSQL + Authentication

Prisma
   ↓
Database Access
```

The system should be designed so that paid infrastructure can be introduced only when actual usage requires it.

---

# 24. Architecture Summary

```text
                       INTERNET
                           │
             ┌─────────────┴─────────────┐
             │                           │
        MOBILE PHONE                LAPTOP/DESKTOP
             │                           │
             └─────────────┬─────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │     VERCEL      │
                  │    Next.js      │
                  │   TypeScript    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │     PRISMA      │
                  │  Business Rules │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    SUPABASE     │
                  │   PostgreSQL    │
                  │      Auth       │
                  └─────────────────┘
                           │
                           ▼
                  Business Data
                  Stock / Sales
                  Customers
                  Prices / Profit
                  Reports
```

---

# 25. Technology Decision

The initial technology stack is:

**Next.js + TypeScript + Tailwind CSS + PostgreSQL + Prisma + Supabase + Vercel + GitHub**

The architecture is cloud-based, responsive, production-oriented, and designed to keep development and production environments separate while remaining cost-efficient for the initial scale of the business.