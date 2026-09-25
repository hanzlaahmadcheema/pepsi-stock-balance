import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Role } from "@prisma/client";
import { getDashboardData, DashboardData, OwnerDashboardData } from "@/lib/dashboard/service";
import {
  IconChartBar,
  IconUsers,
  IconPackage,
  IconRotateCcw,
  IconDollarSign,
  IconReceipt,
  IconTruck,
  IconClipboardList,
  IconScale,
  IconBanknotes,
  IconDeviceMobile,
  IconQrCode,
  IconPlus,
  IconCheck,
  IconServer,
  IconHistory,
  IconZap,
} from "@/components/ui/icons";
import {
  ActionTile,
  EmptyState,
  FigureBox,
  SectionTitle,
  StatCard,
  StatusBadge,
  statusLabel,
  statusTone,
} from "@/components/ui/classic";
import { isCloudPortal } from "@/lib/config/portal-mode";

export const dynamic = "force-dynamic";

function formatMoney(amount: number): string {
  return "Rs. " + Math.round(amount).toLocaleString("en-PK");
}

export default async function HomePage() {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const isCloud = isCloudPortal();
  const data: DashboardData = await getDashboardData(user.role);
  const ownerData = isOwner ? (data as OwnerDashboardData) : null;

  const modeLabel = isCloud
    ? isOwner
      ? "Cloud Executive Portal (read-only)"
      : "Cloud Management Portal (read-only)"
    : isOwner
    ? "Owner Control Desk"
    : "Staff Operations Desk";

  const welcomeNote = isCloud
    ? "Read-only view of depot records: sales, stock, customer credit and margins."
    : isOwner
    ? "Today's sales, stock value, money owed to you and profit."
    : "Today's sales, money collected, stock levels and the closing steps.";

  const quickActions = isCloud
    ? [
        { href: "/sales", title: "Sales History", hint: "Invoices and totals", icon: <IconReceipt className="h-5 w-5" /> },
        { href: "/products", title: "Current Stock", hint: "Crates and value", icon: <IconPackage className="h-5 w-5" /> },
        { href: "/customers", title: "Customers & Debt", hint: "Who owes what", icon: <IconUsers className="h-5 w-5" /> },
        { href: "/reports/aging", title: "Debt Aging", hint: "Oldest dues first", icon: <IconHistory className="h-5 w-5" /> },
        { href: "/sync", title: "Depot Sync", hint: "Copy health", icon: <IconServer className="h-5 w-5" /> },
        { href: "/reports", title: "All Reports", hint: "Records and audits", icon: <IconChartBar className="h-5 w-5" /> },
      ]
    : [
        { href: "/sales/new", title: "New Sale", hint: "Write a new invoice", icon: <IconPlus className="h-5 w-5" />, emphasis: true },
        { href: "/receiving/new", title: "Receive Stock", hint: "Add a delivery", icon: <IconTruck className="h-5 w-5" /> },
        { href: "/customers", title: "Customers", hint: "Accounts and credit", icon: <IconUsers className="h-5 w-5" /> },
        { href: "/customers", title: "Take a Payment", hint: "Collect money due", icon: <IconReceipt className="h-5 w-5" /> },
        { href: "/products", title: "Current Stock", hint: "Crates on hand", icon: <IconPackage className="h-5 w-5" /> },
        { href: "/daily-closing", title: "Daily Closing", hint: "Balance the cash", icon: <IconScale className="h-5 w-5" /> },
      ];

  const launcherLinks = [
    { href: "/sales", title: "Sales & Invoices", hint: "Find invoices, print receipts, check payments.", icon: <IconReceipt className="h-5 w-5" /> },
    { href: "/receiving", title: "Receiving / Purchase", hint: "Record supplier crate deliveries.", icon: <IconTruck className="h-5 w-5" /> },
    { href: "/stock-counts", title: "Stock Counts", hint: "Physical count sheets and corrections.", icon: <IconClipboardList className="h-5 w-5" /> },
    { href: "/daily-closing", title: "Daily Closing", hint: "Cash drawer balancing at end of day.", icon: <IconScale className="h-5 w-5" /> },
    { href: "/customers", title: "Customers & Credit", hint: "Balances, credit limits, payments.", icon: <IconUsers className="h-5 w-5" /> },
    { href: "/products", title: "Products & Prices", hint: "Catalog, stock levels, price tiers.", icon: <IconPackage className="h-5 w-5" /> },
    { href: "/returns", title: "Returns & Quarantine", hint: "Returned crates and inspection.", icon: <IconRotateCcw className="h-5 w-5" /> },
  ];

  const ownerLinks = [
    { href: "/reports", title: "Reports", hint: "Sales, stock, dispatch and customer ledgers.", icon: <IconChartBar className="h-5 w-5" /> },
    { href: "/reports/profit", title: "Profit & Margins", hint: "Owner-only profit per product and invoice.", icon: <IconDollarSign className="h-5 w-5" /> },
    { href: "/settings/users", title: "Staff Accounts", hint: "Add staff, set roles, switch people on or off.", icon: <IconUsers className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader user={user} />

      <main className="mx-auto w-full max-w-[1720px] space-y-8 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
        {/* ---------------- Page heading + primary actions ---------------- */}
        <div className="panel">
          <div className="flex flex-col gap-4 border-b-2 border-rule bg-surface-alt px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-info">{modeLabel}</span>
                <span className="text-sm text-ink-2">
                  Business date <strong className="num">{data.businessDate}</strong> (Asia/Karachi)
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-bold">Welcome back, {user.name}</h1>
              <p className="mt-1 text-base text-ink-2">{welcomeNote}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {isCloud ? (
                <>
                  <Link href="/reports" className="btn btn-primary">
                    <IconClipboardList className="h-5 w-5" />
                    All Reports
                  </Link>
                  {isOwner ? (
                    <Link href="/reports/profit" className="btn">
                      <IconChartBar className="h-5 w-5" />
                      Profit &amp; Margins
                    </Link>
                  ) : null}
                  <Link href="/sync" className="btn">
                    <IconServer className="h-5 w-5" />
                    Sync Status
                  </Link>
                </>
              ) : (
                <>
                  {!isOwner ? (
                    <Link href="/sales/new" className="btn btn-primary btn-lg">
                      <IconPlus className="h-5 w-5" />
                      New Sale / Invoice
                    </Link>
                  ) : null}
                  {isOwner ? (
                    <Link href="/reports/profit" className="btn btn-primary">
                      <IconChartBar className="h-5 w-5" />
                      Profit Report
                    </Link>
                  ) : null}
                  <Link href="/daily-closing" className="btn">
                    <IconScale className="h-5 w-5" />
                    Daily Closing
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ---------------- Quick actions ---------------- */}
        <section>
          <SectionTitle aside={isCloud ? "Browse depot records" : "Pick one to begin"}>
            {isCloud ? "Go to a Record" : "What do you want to do?"}
          </SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {quickActions.map((action) => (
              <ActionTile
                key={`${action.title}-${action.href}`}
                href={action.href}
                title={action.title}
                hint={action.hint}
                icon={action.icon}
                emphasis={"emphasis" in action && action.emphasis === true}
              />
            ))}
          </div>
        </section>

        {/* ---------------- Things needing attention ---------------- */}
        <section>
          <SectionTitle>Things To Do Next</SectionTitle>
          {data.pendingTasks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className={`panel flex flex-col justify-between ${
                    task.priority === "high" ? "border-l-8 border-l-warn" : ""
                  }`}
                >
                  <div className="px-4 py-3.5">
                    <StatusBadge tone={task.priority === "high" ? "warn" : "info"}>{task.badge}</StatusBadge>
                    <h3 className="mt-2 text-lg font-bold leading-snug text-ink">{task.title}</h3>
                    <p className="mt-1 text-sm leading-snug text-ink-2">{task.description}</p>
                  </div>
                  <div className="border-t-2 border-rule px-4 py-3">
                    <Link href={task.href} className="btn btn-sm">
                      Open This Task
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="notice notice-good">
              <IconCheck className="h-5 w-5 shrink-0 text-good" />
              <span>
                <strong>Nothing is waiting on you.</strong> Stock count is {statusLabel(data.stockCount.status).toLowerCase()} and
                daily closing is {statusLabel(data.dailyClosing.status).toLowerCase()}.
              </span>
            </div>
          )}
        </section>

        {/* ---------------- Key numbers ---------------- */}
        <section>
          <SectionTitle aside={data.businessDate}>Today&apos;s Key Numbers</SectionTitle>
          {isOwner && ownerData ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Sales Today"
                value={formatMoney(ownerData.sales.revenue)}
                tone="info"
                badge={<StatusBadge tone="good">Completed</StatusBadge>}
                note={
                  <>
                    <strong>{ownerData.sales.invoicesCount}</strong> invoices ·{" "}
                    <strong>{ownerData.sales.cratesSold}</strong> crates sold
                    {ownerData.sales.cancelledInvoicesCount > 0
                      ? ` · ${ownerData.sales.cancelledInvoicesCount} cancelled`
                      : ""}
                  </>
                }
                actions={
                  <>
                    <span className="text-ink-3">Paid at counter {formatMoney(ownerData.sales.immediatePaidAmount)}</span>
                    <Link href="/reports/sales" className="link-btn ml-auto">
                      Sales Report
                    </Link>
                  </>
                }
              />

              <StatCard
                label="Gross Profit Today"
                value={formatMoney(ownerData.profit.todayGrossProfit)}
                tone="good"
                badge={<StatusBadge tone="info">Owner only</StatusBadge>}
                note={
                  <>
                    Margin <strong>{ownerData.profit.todayGrossMarginPercent.toFixed(1)}%</strong> · goods cost{" "}
                    {formatMoney(ownerData.profit.todayCostOfGoodsSold)}
                  </>
                }
                actions={
                  <Link href="/reports/profit" className="link-btn ml-auto">
                    Profit Details
                  </Link>
                }
              />

              <StatCard
                label="Money Owed To You"
                value={formatMoney(ownerData.customers.totalCreditOutstanding)}
                tone="warn"
                badge={<StatusBadge tone="neutral">{ownerData.customers.totalActive} customers</StatusBadge>}
                note="Balance still to be collected from customer credit accounts."
                actions={
                  <>
                    <Link href="/customers" className="link-btn">
                      Customer Accounts
                    </Link>
                    <Link href="/reports/customers" className="link-btn ml-auto">
                      Credit Ledger
                    </Link>
                  </>
                }
              />

              <StatCard
                label="Stock On Hand"
                value={ownerData.inventory.totalStockCrates}
                unit="crates"
                tone={ownerData.inventory.lowStockCount > 0 ? "warn" : "neutral"}
                badge={
                  ownerData.inventory.lowStockCount > 0 ? (
                    <StatusBadge tone="warn">{ownerData.inventory.lowStockCount} low</StatusBadge>
                  ) : (
                    <StatusBadge tone="good">Enough stock</StatusBadge>
                  )
                }
                note={
                  <>
                    Worth {formatMoney(ownerData.inventory.totalValuation)} ·{" "}
                    {ownerData.inventory.outOfStockCount} items at zero
                  </>
                }
                actions={
                  <>
                    <Link href="/products" className="link-btn">
                      Product List
                    </Link>
                    <Link href="/reports/stock" className="link-btn ml-auto">
                      Stock Ledger
                    </Link>
                  </>
                }
              />

              <StatCard
                label="Stock Count Today"
                value={
                  data.stockCount.totalProductsCounted > 0
                    ? data.stockCount.totalProductsCounted
                    : "Not started"
                }
                unit={data.stockCount.totalProductsCounted > 0 ? "products counted" : undefined}
                tone={data.stockCount.discrepanciesCount > 0 ? "warn" : "neutral"}
                badge={<StatusBadge tone={statusTone(data.stockCount.status)}>{statusLabel(data.stockCount.status)}</StatusBadge>}
                note={
                  <>
                    {data.stockCount.discrepanciesCount} differences found ·{" "}
                    {data.stockCount.pendingAdjustmentsCount} corrections to approve
                  </>
                }
                actions={
                  <Link href="/stock-counts" className="link-btn ml-auto">
                    Count Sheets
                  </Link>
                }
              />

              <StatCard
                label="Daily Closing"
                value={
                  data.dailyClosing.status === "CLOSED"
                    ? "Closed"
                    : data.dailyClosing.status === "IN_REVIEW"
                    ? "Sent for approval"
                    : "Still open"
                }
                tone={statusTone(data.dailyClosing.status)}
                badge={<StatusBadge tone={statusTone(data.dailyClosing.status)}>{statusLabel(data.dailyClosing.status)}</StatusBadge>}
                note={
                  data.dailyClosing.status === "CLOSED" || data.dailyClosing.status === "IN_REVIEW"
                    ? `Cash counted ${formatMoney(ownerData.dailyClosing.physicalCash)} · difference ${formatMoney(ownerData.dailyClosing.cashDifference)}`
                    : `Cash expected in drawer ${formatMoney(ownerData.payments.totalCashCollected)}`
                }
                actions={
                  <Link href="/daily-closing" className="link-btn ml-auto">
                    Closing Reconciliation
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Sales Activity"
                value={data.sales.invoicesCount}
                unit="invoices"
                tone="info"
                badge={<StatusBadge tone="good">Completed</StatusBadge>}
                note={
                  <>
                    <strong>{data.sales.cratesSold}</strong> crates sent out today
                    {data.sales.cancelledInvoicesCount > 0
                      ? ` · ${data.sales.cancelledInvoicesCount} cancelled`
                      : ""}
                  </>
                }
                actions={
                  <>
                    <Link href="/sales" className="link-btn">
                      All Invoices
                    </Link>
                    <Link href="/sales/new" className="link-btn ml-auto">
                      New Sale
                    </Link>
                  </>
                }
              />

              <StatCard
                label="Money Collected"
                value={formatMoney(data.payments.totalPaymentsCollected)}
                tone="good"
                badge={<StatusBadge tone="good">Cash + digital</StatusBadge>}
                note={
                  <>
                    Cash {formatMoney(data.payments.totalCashCollected)} · digital{" "}
                    {formatMoney(data.payments.totalDigitalPayments)}
                  </>
                }
                actions={
                  <Link href="/daily-closing" className="link-btn ml-auto">
                    Cash Drawer
                  </Link>
                }
              />

              <StatCard
                label="Stock On Hand"
                value={data.inventory.totalStockCrates}
                unit="crates"
                tone={data.inventory.lowStockCount > 0 ? "warn" : "neutral"}
                badge={
                  data.inventory.lowStockCount > 0 ? (
                    <StatusBadge tone="warn">{data.inventory.lowStockCount} low</StatusBadge>
                  ) : (
                    <StatusBadge tone="good">Enough stock</StatusBadge>
                  )
                }
                note="Crates available across products in the catalog."
                actions={
                  <>
                    <Link href="/products" className="link-btn">
                      Product List
                    </Link>
                    <Link href="/receiving" className="link-btn ml-auto">
                      Receiving
                    </Link>
                  </>
                }
              />

              <StatCard
                label="Items Running Low"
                value={data.inventory.lowStockCount}
                unit="products"
                tone={data.inventory.lowStockCount > 0 ? "warn" : "good"}
                badge={
                  data.inventory.lowStockCount > 0 ? (
                    <StatusBadge tone="warn">Needs attention</StatusBadge>
                  ) : (
                    <StatusBadge tone="good">All healthy</StatusBadge>
                  )
                }
                note={
                  data.inventory.outOfStockCount > 0
                    ? `${data.inventory.outOfStockCount} products have no crates left.`
                    : "Every product has crates available."
                }
                actions={
                  <Link href="/products" className="link-btn ml-auto">
                    Check Levels
                  </Link>
                }
              />

              <StatCard
                label="Stock Count"
                value={
                  data.stockCount.totalProductsCounted > 0 ? data.stockCount.totalProductsCounted : "Not started"
                }
                unit={data.stockCount.totalProductsCounted > 0 ? "products counted" : undefined}
                tone="neutral"
                badge={<StatusBadge tone={statusTone(data.stockCount.status)}>{statusLabel(data.stockCount.status)}</StatusBadge>}
                note={
                  data.stockCount.totalProductsCounted > 0
                    ? `${data.stockCount.discrepanciesCount} differences found · ${data.stockCount.pendingAdjustmentsCount} corrections waiting`
                    : "Count the shelves to confirm the system matches."
                }
                actions={
                  <Link
                    href={data.stockCount.closingId ? `/stock-counts/${data.stockCount.closingId}` : "/stock-counts/new"}
                    className="link-btn ml-auto"
                  >
                    {data.stockCount.totalProductsCounted > 0 ? "See Count Sheet" : "Start Physical Count"}
                  </Link>
                }
              />

              <StatCard
                label="Daily Closing"
                value={
                  data.dailyClosing.status === "CLOSED"
                    ? "Closed"
                    : data.dailyClosing.status === "IN_REVIEW"
                    ? "Sent to owner"
                    : "Still open"
                }
                tone={statusTone(data.dailyClosing.status)}
                badge={<StatusBadge tone={statusTone(data.dailyClosing.status)}>{statusLabel(data.dailyClosing.status)}</StatusBadge>}
                note={`Cash expected in drawer ${formatMoney(data.payments.totalCashCollected)}.`}
                actions={
                  <Link href="/daily-closing" className="link-btn ml-auto">
                    Reconciliation Form
                  </Link>
                }
              />
            </div>
          )}
        </section>

        {/* ---------------- Money by payment method ---------------- */}
        <section className="panel">
          <div className="flex flex-col gap-2 border-b-2 border-rule bg-surface-alt px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Money Received Today, By Payment Method</h2>
              <p className="text-sm text-ink-2">Counter payments and customer account settlements.</p>
            </div>
            <div className="sm:text-right">
              <span className="text-sm text-ink-3">Total collected</span>
              <p className="num text-2xl font-bold text-good">{formatMoney(data.payments.totalPaymentsCollected)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <FigureBox label="Cash Drawer" value={formatMoney(data.payments.totalCashCollected)} icon={<IconBanknotes className="h-5 w-5" />} />
            <FigureBox label="EasyPaisa" value={formatMoney(data.payments.totalEasyPaisaCollected)} icon={<IconDeviceMobile className="h-5 w-5" />} />
            <FigureBox label="JazzCash" value={formatMoney(data.payments.totalJazzCashCollected)} icon={<IconDeviceMobile className="h-5 w-5" />} />
            <FigureBox label="QR Code" value={formatMoney(data.payments.totalQrCollected)} icon={<IconQrCode className="h-5 w-5" />} />
            {data.payments.totalMpesaCollected > 0 ? (
              <FigureBox label="M-Pesa" value={formatMoney(data.payments.totalMpesaCollected)} icon={<IconDeviceMobile className="h-5 w-5" />} />
            ) : null}
          </div>
        </section>

        {/* ---------------- Owner: corrections to approve ---------------- */}
        {isOwner && ownerData && ownerData.pendingAdjustments.length > 0 ? (
          <section className="panel">
            <div className="flex flex-col gap-3 border-b-2 border-rule bg-surface-alt px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <StatusBadge tone="warn">Owner action required</StatusBadge>
                <h2 className="mt-1.5 text-lg font-bold">
                  Stock Differences Waiting For Your Decision ({ownerData.pendingAdjustments.length})
                </h2>
                <p className="text-sm text-ink-2">
                  The count sheet did not match the system. Approve or reject each correction once.
                </p>
              </div>
              <Link href="/stock-counts" className="btn">
                Review All
              </Link>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="num">
                      Count Difference
                    </th>
                    <th scope="col">Reason Given</th>
                    <th scope="col">Counted By</th>
                    <th scope="col" className="num">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ownerData.pendingAdjustments.map((adj) => (
                    <tr key={adj.id}>
                      <td>
                        <strong>{adj.productName}</strong> <span className="text-ink-3">({adj.productBrand})</span>
                      </td>
                      <td className={`num font-bold ${adj.difference > 0 ? "text-good" : "text-stamp"}`}>
                        {adj.difference > 0 ? `+${adj.difference}` : adj.difference} crates
                      </td>
                      <td className="max-w-xs">{adj.reason}</td>
                      <td>{adj.requestedByName}</td>
                      <td className="num">
                        <Link
                          href={adj.closingId ? `/stock-counts/${adj.closingId}` : "/stock-counts"}
                          className="link-btn"
                        >
                          Decide
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ---------------- Low stock watchlist ---------------- */}
        {data.inventory.lowStockProducts.length > 0 ? (
          <section className="panel">
            <div className="flex flex-col gap-3 border-b-2 border-rule bg-surface-alt px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Products Running Low ({data.inventory.lowStockCount} products)
                </h2>
                <p className="text-sm text-ink-2">These have reached or passed their minimum stock level.</p>
              </div>
              <Link href={isOwner ? "/receiving/new" : "/products"} className="btn">
                {isOwner ? "Record a Delivery" : "See Full Product List"}
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.inventory.lowStockProducts.map((product) => {
                const isEmpty = product.currentStock <= 0;
                return (
                  <div key={product.id} className="rounded-lg border-2 border-rule bg-surface-alt px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-bold leading-snug text-ink">{product.name}</p>
                        <p className="text-sm text-ink-3">Brand: {product.brand}</p>
                      </div>
                      <StatusBadge tone={isEmpty ? "bad" : "warn"}>{isEmpty ? "Out of stock" : "Low stock"}</StatusBadge>
                    </div>
                    <p className={`num mt-2 text-xl font-bold ${isEmpty ? "text-stamp" : "text-warn"}`}>
                      {product.currentStock} of {product.minimumStockLevel} crates
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ---------------- Everything else on the register ---------------- */}
        <section>
          <SectionTitle aside="Every screen in this software">All Screens</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {!isOwner ? (
              <ActionTile
                href="/sales/new"
                title="New Sale / Invoice"
                hint="Start a fresh retail or wholesale invoice."
                icon={<IconZap className="h-5 w-5" />}
                emphasis
              />
            ) : null}
            {launcherLinks.map((link) => (
              <ActionTile
                key={`${link.title}-${link.href}`}
                href={link.href}
                title={link.title}
                hint={link.hint}
                icon={link.icon}
              />
            ))}
            {isOwner
              ? ownerLinks.map((link) => (
                  <ActionTile
                    key={`${link.title}-${link.href}`}
                    href={link.href}
                    title={link.title}
                    hint={link.hint}
                    icon={link.icon}
                  />
                ))
              : null}
          </div>
          {isCloud ? (
            <div className="mt-4">
              <EmptyState
                title="This is a read-only portal"
                hint="You can look at every record here, but only the main office can add or change them."
              />
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
