"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { Role } from "@prisma/client";
import type { DbUser } from "@/lib/auth";
import { IconMenu, IconClose } from "@/components/ui/icons";

export function AppHeader({ user }: { user: DbUser }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isOwner = user.role === Role.OWNER;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const linkClass = (href: string) => {
    const active = isActive(href);
    return active
      ? "px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs"
      : "px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors";
  };

  const mobileLinkClass = (href: string) => {
    const active = isActive(href);
    return active
      ? "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
      : "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors";
  };

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30 shadow-2xs">
      {/* Top Bar: Brand, User Identity & Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-base text-zinc-900 dark:text-zinc-50">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-2xs">
              P
            </span>
            <span className="tracking-tight">Pepsi Stock Balance</span>
          </Link>
        </div>

        {/* User Identity & Logout on Desktop */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-right">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hidden sm:inline">
              {user.name}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                isOwner
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              }`}
            >
              {user.role}
            </span>
          </div>

          <form action={logoutAction} className="hidden sm:block">
            <button
              type="submit"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </form>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <IconClose className="w-5 h-5" /> : <IconMenu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Second Tier: Logically Grouped Navigation Bar (Desktop lg+) */}
      <div className="hidden lg:block border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-stretch text-xs">
          <nav className="flex items-stretch gap-0">
            {/* Front Office Group */}
            <div className="flex flex-col justify-center px-3 py-1.5 border-r border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1 whitespace-nowrap">
                Front Office
              </span>
              <div className="flex items-center gap-1">
                <Link href="/" className={linkClass("/")}>
                  Dashboard
                </Link>
                <Link href="/sales" className={linkClass("/sales")}>
                  Sales
                </Link>
                <Link href="/customers" className={linkClass("/customers")}>
                  Customers
                </Link>
              </div>
            </div>

            {/* Warehouse / Stock Group */}
            <div className="flex flex-col justify-center px-3 py-1.5 border-r border-zinc-200 dark:border-zinc-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1 whitespace-nowrap">
                Warehouse
              </span>
              <div className="flex items-center gap-1">
                <Link href="/products" className={linkClass("/products")}>
                  Products
                </Link>
                <Link href="/receiving" className={linkClass("/receiving")}>
                  Receiving
                </Link>
                <Link href="/returns" className={linkClass("/returns")}>
                  Returns
                </Link>
                <Link href="/damage" className={linkClass("/damage")}>
                  Damage
                </Link>
                <Link href="/stock-counts" className={linkClass("/stock-counts")}>
                  Stock Counts
                </Link>
              </div>
            </div>

            {/* Reconciliation / Admin Group */}
            <div className="flex flex-col justify-center px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1 whitespace-nowrap">
                Admin
              </span>
              <div className="flex items-center gap-1">
                <Link href="/daily-closing" className={linkClass("/daily-closing")}>
                  Daily Closing
                </Link>
                <Link href="/reports" className={linkClass("/reports")}>
                  Reports
                </Link>

                {isOwner && (
                  <>
                    <Link href="/approvals" className={linkClass("/approvals")}>
                      Approvals
                    </Link>
                    <Link href="/suppliers" className={linkClass("/suppliers")}>
                      Suppliers
                    </Link>
                    <Link href="/settings/users" className={linkClass("/settings/users")}>
                      Users
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile Drawer / Responsive Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 pt-3 pb-6 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
            <span>Signed in as <b>{user.name}</b> ({user.role})</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>

          <div className="space-y-4">
            {/* Front Office */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 px-3 mb-1">
                Front Office
              </div>
              <div className="space-y-1">
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/")}>
                  <span>Dashboard</span>
                </Link>
                <Link href="/sales" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/sales")}>
                  <span>Sales & Invoicing</span>
                </Link>
                <Link href="/customers" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/customers")}>
                  <span>Customers & Credit</span>
                </Link>
              </div>
            </div>

            {/* Warehouse / Stock */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 px-3 mb-1">
                Warehouse / Stock
              </div>
              <div className="space-y-1">
                <Link href="/products" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/products")}>
                  <span>Products & Catalog</span>
                </Link>
                <Link href="/receiving" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/receiving")}>
                  <span>Receiving / Purchases</span>
                </Link>
                <Link href="/returns" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/returns")}>
                  <span>Returns & Quarantine</span>
                </Link>
                <Link href="/damage" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/damage")}>
                  <span>Damage / Expiry</span>
                </Link>
                <Link href="/stock-counts" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/stock-counts")}>
                  <span>Stock Counts</span>
                </Link>
              </div>
            </div>

            {/* Reconciliation / Admin */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 px-3 mb-1">
                Reconciliation & Management
              </div>
              <div className="space-y-1">
                <Link href="/daily-closing" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/daily-closing")}>
                  <span>Daily Closing</span>
                </Link>
                <Link href="/reports" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/reports")}>
                  <span>Reports Hub</span>
                </Link>

                {isOwner && (
                  <>
                    <Link href="/approvals" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/approvals")}>
                      <span>Pending Approvals</span>
                    </Link>
                    <Link href="/suppliers" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/suppliers")}>
                      <span>Suppliers</span>
                    </Link>
                    <Link href="/settings/users" onClick={() => setMobileMenuOpen(false)} className={mobileLinkClass("/settings/users")}>
                      <span>Staff User Management</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
