# Pepsi Stock Balance — Distribution Route Inventory Portal

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A full-stack enterprise web portal designed for beverage distribution operations to reconcile delivery route stock, track product inventory, balance credit/cash settlements, and synchronize distributor ledgers.

---

## 🌟 Key Features

- **Real-Time Stock Balancing**: Calculates driver route dispatch versus return stock with automatic variance reporting.
- **Product & Category Pricing**: Centralized management of product SKUs, tiered pricing, and discount calculations.
- **Multi-Device Synchronization**: Robust data sync layer supporting warehouse dispatch and mobile route drivers.
- **Zero-DB Cleanup & Migration Scripts**: Automated database reset and maintenance scripts that preserve master product catalogs and credentials.
- **Windows Deployment Automation**: Dedicated batch scripts (`start-windows.bat`, `stop-windows.bat`, `update-and-run.bat`) for easy local operations.

---

## 🛠️ Tech Stack

- **Frontend & Fullstack Framework**: Next.js (App Router, Server Actions)
- **Database & ORM**: Prisma ORM with SQLite / PostgreSQL support
- **Language**: TypeScript
- **Styling**: Tailwind CSS & PostCSS

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/hanzlaahmadcheema/pepsi-stock-balance.git
cd pepsi-stock-balance

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

---

## 👤 Author

Developed by **Hanzla Ahmad**.
