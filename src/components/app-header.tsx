"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { Role } from "@prisma/client";
import type { DbUser } from "@/lib/auth";
import { KeyboardShortcutsModal } from "@/components/ui/keyboard-shortcuts-modal";
import { TextSizeControl } from "@/components/ui/text-size-control";
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
  IconBox,
  IconPlus,
  IconSun,
  IconMoon,
  IconLifebuoy,
  IconServer,
  IconKeyboard,
  IconSettings,
  IconHistory,
  IconBanknotes,
} from "@/components/ui/icons";
import { DbStatusIndicator } from "@/components/db-status-indicator";
import { SystemVersionPill } from "@/components/system-version-pill";
import { isCloudPortal } from "@/lib/config/portal-mode";
import { useTheme } from "@/lib/ui-preferences";

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

function getNavGroups(isCloud: boolean): NavGroup[] {
  if (!isCloud) {
    return [
      {
        id: "home",
        title: "Home",
        items: [{ name: "Dashboard", href: "/", icon: IconChartBar }],
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
        items: [{ name: "Customers & Accounts", href: "/customers", icon: IconUsers }],
      },
      {
        id: "management",
        title: "Management & Day",
        items: [
          { name: "Daily Closing", href: "/daily-closing", icon: IconScale },
          { name: "Business Reports", href: "/reports", icon: IconFileSpreadsheet },
          { name: "Pending Approvals", href: "/approvals", icon: IconShield },
          { name: "Suppliers", href: "/suppliers", icon: IconBox },
          { name: "Settings", href: "/settings", icon: IconSettings },
          { name: "User Management", href: "/settings/users", icon: IconUsers, ownerOnly: true },
          { name: "System Updates", href: "/settings/system-update", icon: IconServer },
          { name: "Technical Services", href: "/technical-services", icon: IconLifebuoy, ownerOnly: true },
        ],
      },
    ];
  }

  // Cloud Read-Only Portal Navigation
  return [
    {
      id: "home",
      title: "Overview",
      items: [{ name: "Dashboard", href: "/", icon: IconChartBar }],
    },
    {
      id: "sales",
      title: "Sales & Invoicing",
      items: [{ name: "Sales History", href: "/sales", icon: IconReceipt }],
    },
    {
      id: "stock",
      title: "Stock & Inventory",
      items: [
        { name: "Current Stock", href: "/products", icon: IconPackage },
        { name: "Receiving History", href: "/receiving", icon: IconTruck },
        { name: "Returns History", href: "/returns", icon: IconRotateCcw },
        { name: "Damaged / Expired", href: "/damage", icon: IconAlertTriangle },
        { name: "Stock Adjustments", href: "/stock-counts", icon: IconClipboardList },
      ],
    },
    {
      id: "customers",
      title: "Customers & Credit",
      items: [
        { name: "Customers & Balances", href: "/customers", icon: IconUsers },
        { name: "Customer Aging", href: "/reports/aging", icon: IconHistory },
      ],
    },
    {
      id: "reports",
      title: "Business Intelligence",
      items: [
        { name: "Reports Hub", href: "/reports", icon: IconFileSpreadsheet },
        { name: "Profit & Margins", href: "/reports/profit", icon: IconChartBar, ownerOnly: true },
        { name: "Aging Report", href: "/reports/aging", icon: IconHistory },
        { name: "Payment Collections", href: "/reports/payments", icon: IconBanknotes },
      ],
    },
    {
      id: "operations",
      title: "Operations & Sync",
      items: [
        { name: "Daily Closing", href: "/daily-closing", icon: IconScale },
        { name: "Depot Sync Status", href: "/sync", icon: IconServer },
        { name: "Suppliers", href: "/suppliers", icon: IconBox },
      ],
    },
  ];
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/" || pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];

  if (first === "sales") {
    if (parts[1] === "new") return [{ label: "New Sale" }];
    const items: BreadcrumbItem[] = [{ label: "Sales History", href: "/sales" }];
    if (parts[2] === "edit") {
      items.push({ label: `Invoice #${parts[1].slice(0, 8)}`, href: `/sales/${parts[1]}` });
      items.push({ label: "Edit" });
    } else if (parts[1]) {
      items.push({ label: `Invoice #${parts[1].slice(0, 8)}` });
    }
    return items;
  }

  if (first === "customers") {
    if (parts[2] === "payments") {
      return [
        { label: "Customers & Accounts", href: "/customers" },
        { label: "Customer Account", href: `/customers/${parts[1]}` },
        { label: "Record Payment" },
      ];
    }
    if (parts[1]) {
      return [
        { label: "Customers & Accounts", href: "/customers" },
        { label: "Customer Account" },
      ];
    }
    return [{ label: "Customers & Accounts" }];
  }

  if (first === "products") {
    if (parts[1] === "new") return [{ label: "New Product" }];
    if (parts[1]) return [{ label: "Current Stock" }, { label: "Product Details" }];
    return [{ label: "Current Stock" }];
  }

  if (first === "receiving") {
    if (parts[1] === "new") return [{ label: "Receive Delivery" }];
    if (parts[1]) return [{ label: "Receive Stock" }, { label: "Delivery Voucher" }];
    return [{ label: "Receive Stock" }];
  }

  if (first === "returns") {
    if (parts[1] === "new") return [{ label: "Record Return" }];
    if (parts[1]) return [{ label: "Returns" }, { label: "Inspection & Voucher" }];
    return [{ label: "Returns" }];
  }

  if (first === "damage") return [{ label: "Damaged / Expired" }];

  if (first === "stock-counts") {
    if (parts[1]) return [{ label: "Stock Adjustments" }, { label: "Stock Count Audit" }];
    return [{ label: "Stock Adjustments" }];
  }

  if (first === "daily-closing") {
    if (parts[1]) return [{ label: "Daily Closing" }, { label: "Daily Reconciliation" }];
    return [{ label: "Daily Closing" }];
  }

  if (first === "reports") {
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
      aging: "Aging Report",
      payments: "Payment Collections",
    };
    if (parts[1] && reportNames[parts[1]]) {
      return [{ label: "Business Reports", href: "/reports" }, { label: reportNames[parts[1]] }];
    }
    return [{ label: "Business Reports" }];
  }

  if (first === "approvals") return [{ label: "Pending Approvals" }];
  if (first === "suppliers") return [{ label: "Suppliers Directory" }];
  if (first === "sync") return [{ label: "Depot Sync Status" }];

  if (first === "settings" && parts[1] === "users") return [{ label: "User Management" }];
  if (first === "settings" && parts[1] === "system-update") return [{ label: "System Updates" }];
  if (first === "settings") return [{ label: "Settings" }];
  if (first === "technical-services") return [{ label: "Technical Services" }];

  return [{ label: first ? first.charAt(0).toUpperCase() + first.slice(1) : "Home" }];
}

export function AppHeader({ user }: { user: DbUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [theme, applyTheme] = useTheme();
  const isOwner = user.role === Role.OWNER;
  const isCloud = isCloudPortal();
  const navGroups = getNavGroups(isCloud);

  // Global Keyboard Shortcuts (Alt + N, Alt + H, Alt + P, Alt + C, Alt + R, ?)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (!isCloud && e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        router.push("/sales/new");
        return;
      }

      if (e.altKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        router.push("/");
        return;
      }

      if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        router.push("/products");
        return;
      }

      if (e.altKey && (e.key === "c" || e.key === "C") && !pathname.startsWith("/sales/new")) {
        e.preventDefault();
        router.push("/customers");
        return;
      }

      if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        router.push("/reports");
        return;
      }

      if (e.key === "?" && !isInput && !pathname.startsWith("/sales/new")) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [router, pathname, isCloud]);

  const toggleTheme = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/dashboard";
    if (href === "/sales") {
      return pathname === "/sales" || (pathname.startsWith("/sales/") && !pathname.startsWith("/sales/new"));
    }
    if (href === "/settings") {
      return pathname === "/settings" || pathname.startsWith("/settings/crates");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const breadcrumbs = resolveBreadcrumbs(pathname);
  const pageTitle = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : "Dashboard";

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const navList = (variant: "rail" | "drawer") => {
    const isRail = variant === "rail";
    const show = isRail
      ? "sr-only group-hover/rail:not-sr-only group-focus-within/rail:not-sr-only"
      : "";

    return (
      <>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.ownerOnly || isOwner);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.id} className={isRail ? "mb-3 last:mb-0" : "mb-6 last:mb-0"}>
              <h2
                className={
                  isRail
                    ? `sr-only mb-1.5 px-1 text-sm font-bold uppercase tracking-widest text-ink-3 ${show}`
                    : "mb-1.5 px-1 text-sm font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-300"
                }
              >
                {group.title}
              </h2>
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={variant === "drawer" ? () => setMobileMenuOpen(false) : undefined}
                        aria-current={active ? "page" : undefined}
                        title={isRail ? item.name : undefined}
                        className={`flex w-full min-h-[2.75rem] items-center gap-3 rounded-md border-2 py-2 pr-3 pl-3.5 text-lg font-bold transition-colors group-hover/rail:min-h-[3.25rem] group-focus-within/rail:min-h-[3.25rem] ${
                          isRail
                            ? "justify-center group-hover/rail:justify-start group-focus-within/rail:justify-start"
                            : ""
                        } ${
                          active
                            ? "border-navy-deep bg-navy text-white shadow-[0_2px_0_0_var(--navy-deep)]"
                            : "border-transparent text-zinc-700 hover:border-rule-strong hover:bg-surface-alt dark:text-zinc-100"
                        }`}
                      >
                        <Icon className={`h-6 w-6 shrink-0 ${active ? "text-white" : "text-navy"}`} />
                        <span className={`leading-tight ${show}`}>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. NAVIGATION RAIL (lg+) — icons at rest, full names on pointer or focus */}
      {/* ========================================================================= */}
      <aside className="app-sidebar group/rail fixed inset-y-0 left-0 z-40 hidden flex-col border-r-2 border-rule bg-surface text-ink lg:flex">
        {/* Brand */}
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-rule px-4 py-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-navy-deep bg-navy text-2xl font-bold text-white">
            P
          </span>
          <div className="sr-only leading-tight group-hover/rail:not-sr-only group-focus-within/rail:not-sr-only">
            <span className="block text-lg font-bold text-ink">Pepsi Distribution</span>
            <span className="block text-sm font-semibold text-ink-3">Stock &amp; Balance System</span>
          </div>
        </div>

        {/* Signed-in operator */}
        <div className="hidden shrink-0 border-b-2 border-rule bg-surface-alt px-4 py-3 group-hover/rail:block group-focus-within/rail:block">
          <div className="text-xs font-bold uppercase tracking-widest text-ink-3">Signed in as</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-ink">{user.name}</span>
            <span
              className={`shrink-0 rounded border-2 px-2 py-0.5 text-sm font-bold uppercase ${
                isOwner
                  ? "border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  : "border-navy bg-navy-wash text-navy"
              }`}
            >
              {user.role}
            </span>
          </div>
        </div>

        {/* Every destination. Icons carry the rail; names appear on hover/focus. */}
        <nav aria-label="All screens" className="flex-1 overflow-y-auto px-3 py-4">
          {navList("rail")}
        </nav>

        {/* Footer: sign out and software version */}
        <div className="shrink-0 space-y-2 border-t-2 border-rule bg-surface-alt px-3 py-3">
          <form action={logoutAction}>
            <button type="submit" className="btn btn-danger w-full">
              <IconClose className="h-5 w-5" />
              <span className="sr-only group-hover/rail:not-sr-only group-focus-within/rail:not-sr-only">
                Sign Out
              </span>
            </button>
          </form>
          <div className="hidden justify-center pt-1 group-hover/rail:flex group-focus-within/rail:flex">
            <SystemVersionPill isOwner={isOwner} />
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. TOP BAR — page name, today's date, and the controls that matter      */}
      {/* ========================================================================= */}
      <header className="app-topbar sticky top-0 z-30 border-b-2 border-rule bg-surface lg:pl-[7.5rem]">
        <div className="mx-auto flex w-full max-w-[1720px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:flex-nowrap lg:px-8">
          {/* Left: menu button on small screens, then "you are here" */}
          <div className="flex flex-1 items-center gap-3 lg:min-w-[9rem]">
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="btn shrink-0 px-3"
                aria-label="Open all screens menu"
                aria-expanded={mobileMenuOpen}
              >
                <IconMenu className="h-6 w-6" />
              </button>
            </div>

            <div className="min-w-0">
              {/* Breadcrumb trail stays visible so nobody gets lost */}
              <nav aria-label="Breadcrumbs" className="flex items-center gap-1 overflow-hidden text-xs font-semibold leading-tight">
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <span key={idx} className="flex items-center gap-1">
                      {idx > 0 && <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
                      {crumb.href && !isLast ? (
                        <Link href={crumb.href} className="link">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="uppercase tracking-widest text-ink-3">{crumb.label}</span>
                      )}
                    </span>
                  );
                })}
              </nav>
              <h1 className="truncate text-xl font-bold leading-tight text-ink">{pageTitle}</h1>
            </div>
          </div>

          {/* Right: the controls an operator actually reaches for */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:shrink-0 lg:flex-nowrap">
            <span className="hidden whitespace-nowrap text-sm font-semibold text-ink-2 2xl:inline">{today}</span>

            <div className="hidden sm:flex lg:hidden xl:flex">
              <DbStatusIndicator />
            </div>

            <TextSizeControl compact />

            <button
              type="button"
              onClick={toggleTheme}
              className="btn px-3"
              title={theme === "dark" ? "Switch to Day (light) screen" : "Switch to Night Depot (dark) screen"}
              aria-label={theme === "dark" ? "Switch to Day screen" : "Switch to Night Depot screen"}
            >
              {theme === "dark" ? (
                <>
                  <IconSun className="h-6 w-6" />
                  <span className="hidden xl:inline">Day</span>
                </>
              ) : (
                <>
                  <IconMoon className="h-6 w-6" />
                  <span className="hidden xl:inline">Night</span>
                </>
              )}
            </button>

            <div className="hidden sm:block">
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="btn px-3"
                title="Keyboard shortcuts"
                aria-label="Keyboard shortcuts"
              >
                <IconKeyboard className="h-6 w-6" />
                <span className="hidden xl:inline">Keys</span>
              </button>
            </div>

            {isCloud ? (
              <span className="badge badge-info">Read-Only Portal</span>
            ) : (
              <div className="hidden lg:block">
                <Link href="/sales/new" className="btn btn-primary">
                  <IconPlus className="h-6 w-6 stroke-[2.5]" />
                  <span>New Sale</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. ALL-SCREENS DRAWER (small screens) — the same list, big touch rows   */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="relative flex h-full w-[22rem] max-w-[90vw] flex-col border-r-2 border-rule bg-surface text-ink shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-rule px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-navy-deep bg-navy text-xl font-bold text-white">
                  P
                </span>
                <span className="text-lg font-bold">All Screens</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="btn px-3"
                aria-label="Close menu"
              >
                <IconClose className="h-6 w-6" />
              </button>
            </div>

            <div className="shrink-0 border-b-2 border-rule bg-surface-alt px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-3">Signed in as</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold">{user.name}</span>
                <span
                  className={`shrink-0 rounded border-2 px-2 py-0.5 text-sm font-bold uppercase ${
                    isOwner
                      ? "border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      : "border-navy bg-navy-wash text-navy"
                  }`}
                >
                  {user.role}
                </span>
              </div>
            </div>

            <nav aria-label="All screens" className="flex-1 overflow-y-auto px-3 py-4">
              {navList("drawer")}
            </nav>

            <div className="shrink-0 space-y-3 border-t-2 border-rule bg-surface-alt px-4 py-3">
              <TextSizeControl />
              <form action={logoutAction}>
                <button type="submit" className="btn btn-danger w-full">
                  <IconClose className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BOTTOM BAR (small screens) — the four daily destinations, always up  */}
      {/* ========================================================================= */}
      <nav
        aria-label="Daily screens"
        className="app-bottombar fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t-2 border-rule bg-surface shadow-[0_-2px_0_0_var(--rule)] lg:hidden"
      >
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-sm font-bold ${
            pathname === "/" || pathname === "/dashboard"
              ? "text-navy"
              : "text-zinc-600 dark:text-zinc-300"
          }`}
        >
          <IconChartBar className="h-7 w-7" />
          <span>Home</span>
        </Link>

        <Link
          href="/products"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-sm font-bold ${
            pathname.startsWith("/products") ? "text-navy" : "text-zinc-600 dark:text-zinc-300"
          }`}
        >
          <IconPackage className="h-7 w-7" />
          <span>Stock</span>
        </Link>

        {isCloud ? (
          <Link href="/reports" className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-sm font-bold">
            <span className="flex h-12 w-12 items-center justify-center rounded-md border-2 border-navy-deep bg-navy text-white shadow-[0_2px_0_0_var(--navy-deep)]">
              <IconFileSpreadsheet className="h-7 w-7" />
            </span>
            <span className="text-navy">Reports</span>
          </Link>
        ) : (
          <Link href="/sales/new" className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-sm font-bold">
            <span className="flex h-12 w-12 items-center justify-center rounded-md border-2 border-navy-deep bg-navy text-white shadow-[0_2px_0_0_var(--navy-deep)]">
              <IconPlus className="h-7 w-7 stroke-[2.5]" />
            </span>
            <span className="text-navy">New Sale</span>
          </Link>
        )}

        <Link
          href="/customers"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-sm font-bold ${
            pathname.startsWith("/customers") ? "text-navy" : "text-zinc-600 dark:text-zinc-300"
          }`}
        >
          <IconUsers className="h-7 w-7" />
          <span>Customers</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-300"
        >
          <IconMenu className="h-7 w-7" />
          <span>All Screens</span>
        </button>
      </nav>

      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        isPosContext={pathname.startsWith("/sales/new")}
      />
    </>
  );
}
