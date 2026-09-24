"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { Role } from "@prisma/client";
import type { DbUser } from "@/lib/auth";
import {
  IconMenu,
  IconClose,
  IconChevronRight,
  IconChartBar,
  IconReceipt,
  IconUsers,
  IconPackage,
  IconTruck,
  IconRotateCcw,
  IconAlertTriangle,
  IconClipboardList,
  IconScale,
  IconFileSpreadsheet,
  IconShield,
  IconAlertOctagon,
  IconBox,
  IconPlus,
  IconArrowLeft,
  IconArrowRight,
  IconSun,
  IconMoon,
  IconLifebuoy,
} from "@/components/ui/icons";
import { DbStatusIndicator } from "@/components/db-status-indicator";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "home",
    title: "Home",
    items: [
      { name: "Dashboard", href: "/", icon: IconChartBar },
    ],
  },
  {
    id: "sales",
    title: "Sales",
    items: [
      { name: "New Sale", href: "/sales/new", icon: IconPlus },
      { name: "Sales History", href: "/sales", icon: IconReceipt },
    ],
  },
  {
    id: "stock",
    title: "Stock & Warehouse",
    items: [
      { name: "Current Stock", href: "/products", icon: IconPackage },
      { name: "Receive Stock", href: "/receiving", icon: IconTruck },
      { name: "Returns", href: "/returns", icon: IconRotateCcw },
      { name: "Damaged / Expired", href: "/damage", icon: IconAlertTriangle },
      { name: "Stock Adjustments", href: "/stock-counts", icon: IconClipboardList },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    items: [
      { name: "Customers & Accounts", href: "/customers", icon: IconUsers },
    ],
  },
  {
    id: "management",
    title: "Management & Day",
    items: [
      { name: "Daily Closing", href: "/daily-closing", icon: IconScale },
      { name: "Business Reports", href: "/reports", icon: IconFileSpreadsheet },
      { name: "Pending Approvals", href: "/approvals", icon: IconShield, ownerOnly: true },
      { name: "Suppliers", href: "/suppliers", icon: IconBox, ownerOnly: true },
      { name: "User Management", href: "/settings/users", icon: IconUsers, ownerOnly: true },
      { name: "Technical Services", href: "/technical-services", icon: IconLifebuoy, ownerOnly: true },
    ],
  },
];

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/" || pathname === "/dashboard") {
    return [
      { label: "Home" },
      { label: "Dashboard", href: "/" },
    ];
  }

  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];

  if (first === "sales") {
    const items: BreadcrumbItem[] = [
      { label: "Sales" },
      { label: "Sales History", href: "/sales" },
    ];
    if (parts[1] === "new") items.push({ label: "New Sale" });
    else if (parts[2] === "edit") {
      items.push({ label: `Invoice #${parts[1].slice(0, 8)}`, href: `/sales/${parts[1]}` });
      items.push({ label: "Edit" });
    } else if (parts[1]) {
      items.push({ label: `Invoice #${parts[1].slice(0, 8)}` });
    }
    return items;
  }

  if (first === "customers") {
    const items: BreadcrumbItem[] = [
      { label: "Customers" },
      { label: "Customers & Accounts", href: "/customers" },
    ];
    if (parts[2] === "payments") {
      items.push({ label: "Customer Account", href: `/customers/${parts[1]}` });
      items.push({ label: "Record Payment" });
    } else if (parts[1]) {
      items.push({ label: "Customer Account" });
    }
    return items;
  }

  if (first === "products") {
    const items: BreadcrumbItem[] = [
      { label: "Stock" },
      { label: "Current Stock", href: "/products" },
    ];
    if (parts[1] === "new") items.push({ label: "New Product" });
    else if (parts[1]) items.push({ label: "Product Details" });
    return items;
  }

  if (first === "receiving") {
    const items: BreadcrumbItem[] = [
      { label: "Stock" },
      { label: "Receive Stock", href: "/receiving" },
    ];
    if (parts[1] === "new") items.push({ label: "Receive Delivery" });
    else if (parts[1]) items.push({ label: "Delivery Voucher" });
    return items;
  }

  if (first === "returns") {
    const items: BreadcrumbItem[] = [
      { label: "Stock" },
      { label: "Returns & Quarantine", href: "/returns" },
    ];
    if (parts[1] === "new") items.push({ label: "Record Return" });
    else if (parts[1]) items.push({ label: "Inspection & Voucher" });
    return items;
  }

  if (first === "damage") {
    return [
      { label: "Stock" },
      { label: "Damaged / Expired", href: "/damage" },
    ];
  }

  if (first === "stock-counts") {
    const items: BreadcrumbItem[] = [
      { label: "Stock" },
      { label: "Stock Adjustments", href: "/stock-counts" },
    ];
    if (parts[1] === "new") items.push({ label: "New Stock Count" });
    else if (parts[1]) items.push({ label: "Stock Count Audit" });
    return items;
  }

  if (first === "daily-closing") {
    const items: BreadcrumbItem[] = [
      { label: "Management" },
      { label: "Daily Closing", href: "/daily-closing" },
    ];
    if (parts[1]) items.push({ label: "Daily Reconciliation" });
    return items;
  }

  if (first === "reports") {
    const items: BreadcrumbItem[] = [
      { label: "Management" },
      { label: "Business Reports", href: "/reports" },
    ];
    const reportNames: Record<string, string> = {
      sales: "Sales Report",
      profit: "Gross Profit Report",
      stock: "Stock Valuation",
      receiving: "Goods Intake Report",
      damage: "Damaged Stock Report",
      dispatch: "Stock Dispatch",
      customers: "Customer Balances",
      prices: "Price Tiers",
      "fast-slow": "Product Velocity",
    };
    if (parts[1] && reportNames[parts[1]]) {
      items.push({ label: reportNames[parts[1]] });
    }
    return items;
  }

  if (first === "approvals") {
    return [
      { label: "Management" },
      { label: "Pending Approvals", href: "/approvals" },
    ];
  }

  if (first === "suppliers") {
    return [
      { label: "Management" },
      { label: "Suppliers Directory", href: "/suppliers" },
    ];
  }

  if (first === "sync") {
    return [
      { label: "Management" },
      { label: "Sync Status", href: "/sync/quarantine" },
    ];
  }

  if (first === "settings" && parts[1] === "users") {
    return [
      { label: "Management" },
      { label: "User Management", href: "/settings/users" },
    ];
  }

  if (first === "technical-services") {
    return [
      { label: "Management" },
      { label: "Technical Services", href: "/technical-services" },
    ];
  }

  return [
    { label: "Workspace" },
    { label: first ? first.charAt(0).toUpperCase() + first.slice(1) : "Home", href: `/${first || ""}` },
  ];
}

export function AppHeader({ user }: { user: DbUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const isOwner = user.role === Role.OWNER;

  // Restore desktop collapsed preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pepsi_erp_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  // Sync theme state with DOM on mount
  useEffect(() => {
    try {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("pepsi_theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {}
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("pepsi_erp_sidebar_collapsed", String(next));
    } catch {}
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const breadcrumbs = resolveBreadcrumbs(pathname);

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP ENTERPRISE SIDEBAR (lg+ screen size)                           */}
      {/* ========================================================================= */}
      <aside
        className={`app-sidebar hidden lg:flex lg:flex-col fixed inset-y-0 left-0 z-40 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-800/80 transition-all duration-200 ${
          collapsed ? "app-sidebar-collapsed w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <Link href="/" className="flex items-center gap-3 overflow-hidden group">
            <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-black shadow-sm shrink-0 group-hover:scale-105 transition-transform">
              P
            </span>
            {!collapsed && (
              <div className="leading-tight overflow-hidden">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-50 tracking-tight block truncate">
                  Pepsi Distribution
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium block truncate">
                  Stock &amp; Balance ERP
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* User Identity Snapshot */}
        <div className="px-3 py-3 border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/80 dark:bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                isOwner
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80"
              }`}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate leading-tight">
                  {user.name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                      isOwner
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-700/60"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-700/60"
                    }`}
                  >
                    {user.role}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Operational Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => !item.ownerOnly || isOwner);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id} className="space-y-1">
                {!collapsed ? (
                  <div className="px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    {group.title}
                  </div>
                ) : (
                  <div className="h-2 border-t border-zinc-200 dark:border-zinc-800/60 mx-1 mb-2" />
                )}

                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.name : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 group ${
                          active
                            ? "bg-blue-600 text-white font-semibold shadow-xs shadow-blue-500/20"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900/80"
                        } ${collapsed ? "justify-center px-0" : ""}`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            active
                              ? "text-white"
                              : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200"
                          }`}
                        />
                        {!collapsed && (
                          <span className="truncate flex-1">{item.name}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/40 shrink-0 space-y-1.5">
          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer ${
              collapsed ? "px-0" : ""
            }`}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <>
                <IconSun className="w-4 h-4 text-amber-500" />
                {!collapsed && <span>Light Theme</span>}
              </>
            ) : (
              <>
                <IconMoon className="w-4 h-4 text-indigo-500" />
                {!collapsed && <span>Dark Theme</span>}
              </>
            )}
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={toggleCollapse}
            className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer ${
              collapsed ? "px-0" : ""
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <IconArrowRight className="w-4 h-4" />
            ) : (
              <>
                <IconArrowLeft className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>

          {/* Sign Out Action */}
          <form action={logoutAction}>
            <button
              type="submit"
              className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition-colors cursor-pointer ${
                collapsed ? "px-0" : ""
              }`}
              title="Sign Out"
            >
              <IconClose className="w-3.5 h-3.5" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </form>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. TOP WORKSPACE HEADER (Sticky across all viewpoints)                    */}
      {/* ========================================================================= */}
      <header
        className={`app-topbar sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-all duration-200 ${
          collapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Left: Mobile Brand & Hamburger OR Desktop Breadcrumb Trail */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <IconMenu className="w-5 h-5" />
            </button>

            {/* Mobile Brand Title */}
            <div className="flex items-center gap-2 lg:hidden">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                P
              </span>
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                Pepsi ERP
              </span>
            </div>

            {/* Desktop Dynamic Breadcrumbs */}
            <nav aria-label="Breadcrumbs" className="hidden lg:flex items-center gap-1.5 text-xs">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <div key={idx} className="flex items-center gap-1.5">
                    {idx > 0 && (
                      <IconChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 shrink-0" />
                    )}
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors font-medium"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className={
                          isLast
                            ? "font-bold text-zinc-900 dark:text-zinc-50"
                            : "text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[11px]"
                        }
                      >
                        {crumb.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Right: Operational Controls & Utilities */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* DB Connection Status Pills */}
            <DbStatusIndicator />

            {/* Theme Toggle Button in Topbar */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
              aria-label={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {theme === "dark" ? (
                <>
                  <IconSun className="w-4 h-4 text-amber-500" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <IconMoon className="w-4 h-4 text-indigo-500" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Quick Register Action */}
            <Link
              href="/sales/new"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>New Sale</span>
            </Link>

            {/* Role Badge (Visible on mobile/tablet too) */}
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                isOwner
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              }`}
            >
              {user.role}
            </span>

            {/* Mobile Sign Out (When drawer is closed) */}
            <form action={logoutAction} className="lg:hidden">
              <button
                type="submit"
                className="p-2 rounded-lg text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MOBILE / TABLET RESPONSIVE SLIDE-OVER DRAWER (<lg screens)             */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200 border-r border-zinc-200 dark:border-zinc-800">
            {/* Drawer Header */}
            <div className="h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-sm">
                  P
                </span>
                <div>
                  <div className="font-bold text-sm text-zinc-900 dark:text-zinc-50 leading-tight">
                    Pepsi ERP
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Stock &amp; Balance
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Close navigation menu"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>

            {/* User Identity Banner in Drawer */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-200">{user.name}</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                  {user.role} Session
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Categorized Navigation Links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-6">
              {NAV_GROUPS.map((group) => {
                const visibleItems = group.items.filter((item) => !item.ownerOnly || isOwner);
                if (visibleItems.length === 0) return null;

                return (
                  <div key={group.id} className="space-y-1.5">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-2.5">
                      {group.title}
                    </div>
                    <div className="space-y-1">
                      {visibleItems.map((item) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                              active
                                ? "bg-blue-600 text-white font-semibold shadow-xs"
                                : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-zinc-500 dark:text-zinc-400"}`} />
                            <span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* Drawer Footer / Theme & Sign Out */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 shrink-0 space-y-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {theme === "dark" ? (
                  <>
                    <IconSun className="w-4 h-4 text-amber-500" />
                    <span>Switch to Light Theme</span>
                  </>
                ) : (
                  <>
                    <IconMoon className="w-4 h-4 text-indigo-500" />
                    <span>Switch to Dark Theme</span>
                  </>
                )}
              </button>

              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900/60 transition-colors cursor-pointer"
                >
                  <IconClose className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MOBILE BOTTOM QUICK ACTION BAR (<lg screens)                           */}
      {/* ========================================================================= */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around h-16 px-2 shadow-lg"
      >
        <Link
          href="/"
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
            pathname === "/" || pathname === "/dashboard"
              ? "text-blue-600 dark:text-blue-400 font-bold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <IconChartBar className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>

        <Link
          href="/products"
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
            pathname.startsWith("/products")
              ? "text-blue-600 dark:text-blue-400 font-bold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <IconPackage className="w-5 h-5 mb-0.5" />
          <span>Stock</span>
        </Link>

        {/* Center Primary Action: + New Sale */}
        <Link
          href="/sales/new"
          className="flex flex-col items-center justify-center -mt-5 mx-1"
          aria-label="New Sale"
        >
          <div className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 transition-transform">
            <IconPlus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            New Sale
          </span>
        </Link>

        <Link
          href="/customers"
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
            pathname.startsWith("/customers")
              ? "text-blue-600 dark:text-blue-400 font-bold"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <IconUsers className="w-5 h-5 mb-0.5" />
          <span>Customers</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <IconMenu className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}

