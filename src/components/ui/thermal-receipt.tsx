"use client";

/**
 * ThermalReceipt — Isolated 80mm thermal roll receipt component.
 *
 * Designed for SpeedX (and compatible) 80mm thermal printers.
 * Printable width: 76mm / 72mm (80mm roll).
 * Supports section-based design customization via ReceiptDesignConfig.
 *
 * Isolation contract:
 *  - Does NOT import or call any Next.js router/navigation hooks.
 *  - Does NOT trigger window.print() — that is the caller's responsibility.
 *  - All layout decisions are self-contained in this file.
 *  - Changing receipt layout does NOT affect any other sales UI.
 */

import { useState, useEffect } from "react";
import { formatCrates } from "@/lib/formatters";
import type { SaleDetails } from "@/lib/sales/service";
import {
  ReceiptDesignConfig,
  DEFAULT_RECEIPT_CONFIG,
  getStoredReceiptConfig,
  ReceiptSectionId,
} from "@/lib/receipt/design-config";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Format a date for the receipt: "25-Sep-2026  05:30 PM" */
function formatReceiptDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mon = months[d.getMonth()];
  const year = d.getFullYear();
  const h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = (h % 12 || 12).toString().padStart(2, "0");
  return `${day}-${mon}-${year}  ${h12}:${min} ${ampm}`;
}

/** Format amount without "Rs." prefix — saves precious horizontal space on the items row */
function amt(n: number): string {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Configurable divider — renders boldly on screen and thermal paper */
function Divider({ style = "dashed" }: { style?: "dashed" | "solid" | "double" }) {
  if (style === "double") {
    return (
      <div
        className="my-1.5 border-t-2 border-b-2 border-black py-0.5"
        aria-hidden="true"
      />
    );
  }
  if (style === "solid") {
    return (
      <div
        className="my-1.5 border-t-2 border-solid border-black"
        aria-hidden="true"
      />
    );
  }
  return (
    <div
      className="my-1.5 border-t-2 border-dashed border-black"
      aria-hidden="true"
    />
  );
}

/** One row with left label and right value, high contrast for thermal printing */
function Row({
  label,
  value,
  bold = false,
  className = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex justify-between leading-snug ${bold ? "font-bold" : "font-medium"} ${className}`}>
      <span>{label}</span>
      <span className="text-right ml-2 tabular-nums font-bold">{value}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export interface ThermalReceiptProps {
  sale: SaleDetails;
  config?: ReceiptDesignConfig;
}

export function ThermalReceipt({ sale, config: propConfig }: ThermalReceiptProps) {
  // If config is provided in props, use it directly (e.g., designer live preview).
  // Otherwise, load saved configuration from localStorage with event listener.
  const [localConfig, setLocalConfig] = useState<ReceiptDesignConfig>(
    propConfig || DEFAULT_RECEIPT_CONFIG
  );

  useEffect(() => {
    if (propConfig) {
      setLocalConfig(propConfig);
      return;
    }

    // Client-side initial load
    setLocalConfig(getStoredReceiptConfig());

    const handleConfigChange = (e: Event) => {
      const customEvent = e as CustomEvent<ReceiptDesignConfig>;
      if (customEvent.detail) {
        setLocalConfig(customEvent.detail);
      }
    };

    window.addEventListener("receipt_design_changed", handleConfigChange);
    return () => {
      window.removeEventListener("receipt_design_changed", handleConfigChange);
    };
  }, [propConfig]);

  const activeConfig = propConfig || localConfig;

  const isCancelled = sale.status === "CANCELLED";
  const hasDiscount = sale.discount > 0;
  const hasCredit = sale.creditAmount > 0;
  const hasContainers =
    sale.containers &&
    (sale.containers.plasticCrates > 0 || sale.containers.glassBottles > 0);

  const primaryPayment = sale.payments && sale.payments[0];
  const paymentMethodDisplay = primaryPayment
    ? primaryPayment.paymentMethod.replace(/_/g, " ")
    : "—";

  // Typography settings
  const fontStyle =
    activeConfig.styling.fontFamily === "mono"
      ? "'Courier New', Courier, monospace"
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

  const baseSizeClass =
    activeConfig.styling.baseFontSize === "small"
      ? "text-[12px]"
      : activeConfig.styling.baseFontSize === "large"
      ? "text-[14px]"
      : "text-[13px]";

  const printWidthClass =
    activeConfig.styling.printableWidth === "72mm"
      ? "print:w-[72mm] print:max-w-[72mm]"
      : activeConfig.styling.printableWidth === "80mm"
      ? "print:w-[80mm] print:max-w-[80mm]"
      : "print:w-[76mm] print:max-w-[76mm]";

  const dividerStyle = activeConfig.styling.dividerStyle;

  // Render individual sections
  const renderSection = (sectionId: ReceiptSectionId) => {
    switch (sectionId) {
      case "header": {
        if (!activeConfig.header.show) return null;
        const alignClass =
          activeConfig.header.alignment === "left" ? "text-left" : "text-center";
        return (
          <div key="header" className="space-y-0.5 pb-0.5">
            <div className={`${alignClass} leading-tight space-y-0.5`}>
              <div className="text-[17px] font-black tracking-tight uppercase">
                {activeConfig.header.businessName || "PEPSI REGIONAL OFFICE"}
              </div>
              {activeConfig.header.tagline && (
                <div className="text-[12px] uppercase tracking-wide font-bold">
                  {activeConfig.header.tagline}
                </div>
              )}
              {activeConfig.header.address && (
                <div className="text-[11.5px] font-medium leading-tight pt-0.5 break-words">
                  {activeConfig.header.address}
                </div>
              )}
              {activeConfig.header.phone && (
                <div className="text-[12px] font-bold">
                  Ph: {activeConfig.header.phone}
                </div>
              )}
              {activeConfig.header.taxNumber && (
                <div className="text-[11px] font-semibold">
                  {activeConfig.header.taxNumber}
                </div>
              )}
            </div>
            <Divider style={dividerStyle} />
          </div>
        );
      }

      case "invoiceMeta": {
        if (!activeConfig.invoiceMeta.show) return null;
        return (
          <div key="invoiceMeta" className="space-y-0.5">
            {activeConfig.invoiceMeta.title && (
              <div className="text-center text-[13px] font-extrabold tracking-wider pb-0.5 uppercase">
                {activeConfig.invoiceMeta.title}
              </div>
            )}
            <div className="space-y-0.5">
              {activeConfig.invoiceMeta.showInvoiceNo && (
                <Row
                  label="Invoice:"
                  value={sale.invoiceNumber}
                  bold
                  className="text-[14px]"
                />
              )}
              {activeConfig.invoiceMeta.showDate && (
                <Row label="Date:" value={formatReceiptDate(sale.soldAt)} />
              )}
              {activeConfig.invoiceMeta.showCashier && (
                <Row label="Cashier:" value={sale.createdByName || "—"} />
              )}
              {activeConfig.invoiceMeta.showSaleType && (
                <Row label="Type:" value={sale.saleType.replace(/_/g, " ")} />
              )}
            </div>
            <Divider style={dividerStyle} />
          </div>
        );
      }

      case "customer": {
        if (!activeConfig.customer.show) return null;
        const hasCustomer = Boolean(sale.customer);
        return (
          <div key="customer" className="space-y-0.5">
            {hasCustomer ? (
              <>
                {activeConfig.customer.showCustomerName && (
                  <div className="font-black text-[14px] uppercase">
                    {sale.customer?.name}
                  </div>
                )}
                {activeConfig.customer.showPhone && sale.customer?.phone && (
                  <div className="text-[12px] font-bold">
                    Ph: {sale.customer.phone}
                  </div>
                )}
                {activeConfig.customer.showAddress && sale.customer?.address && (
                  <div className="text-[12px] font-medium break-words">
                    {sale.customer.address}
                  </div>
                )}
              </>
            ) : (
              <div className="font-black text-[13.5px] uppercase">
                {activeConfig.customer.walkInLabel || "WALK-IN / CASH"}
              </div>
            )}
            <Divider style={dividerStyle} />
          </div>
        );
      }

      case "itemsTable": {
        if (!activeConfig.itemsTable.show) return null;
        const spacingClass =
          activeConfig.itemsTable.rowSpacing === "compact" ? "py-0.5" : "py-1";
        const dividerClass =
          activeConfig.itemsTable.itemDivider === "dashed"
            ? "divide-y divide-dashed divide-zinc-400 print:divide-black"
            : activeConfig.itemsTable.itemDivider === "dotted"
            ? "divide-y divide-dotted divide-zinc-400 print:divide-black"
            : activeConfig.itemsTable.itemDivider === "solid"
            ? "divide-y divide-solid divide-zinc-400 print:divide-black"
            : "";

        return (
          <div key="itemsTable" className="space-y-1">
            <table className="w-full leading-tight border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-[12px] uppercase font-black">
                  {activeConfig.itemsTable.showItemName && (
                    <th className="text-left pb-1 font-black">Item</th>
                  )}
                  {activeConfig.itemsTable.showQty && (
                    <th className="text-right pb-1 font-black pl-1">Qty</th>
                  )}
                  {activeConfig.itemsTable.showRate && (
                    <th className="text-right pb-1 font-black pl-1">Rate</th>
                  )}
                  {activeConfig.itemsTable.showAmount && (
                    <th className="text-right pb-1 font-black pl-1">Amount</th>
                  )}
                </tr>
              </thead>
              <tbody className={dividerClass}>
                {sale.items.map((item) => (
                  <tr key={item.id} className="align-top">
                    {activeConfig.itemsTable.showItemName && (
                      <td
                        className={`text-left ${spacingClass} pr-1 font-bold break-words leading-tight text-[12.5px]`}
                      >
                        {item.productName}
                      </td>
                    )}
                    {activeConfig.itemsTable.showQty && (
                      <td
                        className={`text-right ${spacingClass} pl-1 tabular-nums whitespace-nowrap font-bold`}
                      >
                        {formatCrates(item.quantity)}
                      </td>
                    )}
                    {activeConfig.itemsTable.showRate && (
                      <td
                        className={`text-right ${spacingClass} pl-1 tabular-nums whitespace-nowrap font-medium`}
                      >
                        {amt(item.unitPrice)}
                      </td>
                    )}
                    {activeConfig.itemsTable.showAmount && (
                      <td
                        className={`text-right ${spacingClass} pl-1 tabular-nums whitespace-nowrap font-black`}
                      >
                        {amt(item.totalAmount)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <Divider style={dividerStyle} />
          </div>
        );
      }

      case "totals": {
        if (!activeConfig.totals.show) return null;
        return (
          <div key="totals" className="space-y-1">
            {activeConfig.totals.showSubtotal && hasDiscount && (
              <Row
                label={`Subtotal (${sale.items.reduce((a, i) => a + i.quantity, 0)} crates):`}
                value={amt(sale.subtotal)}
              />
            )}
            {activeConfig.totals.showDiscount && hasDiscount && (
              <Row
                label="Discount:"
                value={`-${amt(sale.discount)}`}
              />
            )}

            {/* Prominent Total Line */}
            <div className="flex justify-between font-black text-[17px] leading-tight border-t-2 border-b-2 border-black py-1 my-1">
              <span className="uppercase">
                {activeConfig.totals.totalLabel || "TOTAL"}
              </span>
              <span className="tabular-nums font-black">{amt(sale.totalAmount)}</span>
            </div>

            {activeConfig.totals.showPaid && (
              <Row
                label={activeConfig.totals.paidLabel || "PAID"}
                value={amt(sale.paidAmount)}
                bold
                className="text-[14px]"
              />
            )}

            {activeConfig.totals.showCredit && hasCredit && (
              <Row
                label={activeConfig.totals.creditLabel || "CREDIT"}
                value={amt(sale.creditAmount)}
                bold
                className="text-[14px] font-black"
              />
            )}

            {!hasCredit && (
              <Row
                label="BALANCE"
                value={activeConfig.totals.balancePaidFullLabel || "0 (PAID FULL)"}
              />
            )}

            {activeConfig.totals.showPaymentMethod && (
              <Row label="Payment:" value={paymentMethodDisplay} />
            )}
            <Divider style={dividerStyle} />
          </div>
        );
      }

      case "customerLedger": {
        if (!activeConfig.customerLedger.show) return null;
        const hasLedgerBalance =
          sale.customer && sale.customer.outstandingBalance > 0;
        if (!hasLedgerBalance && activeConfig.customerLedger.showOnlyIfBalance) {
          return null;
        }
        const balanceVal = sale.customer ? sale.customer.outstandingBalance : 0;
        return (
          <div key="customerLedger" className="space-y-0.5">
            <Row
              label={activeConfig.customerLedger.label || "Customer Ledger:"}
              value={amt(balanceVal)}
              bold
              className="text-[14px] font-black"
            />
            <Divider style={dividerStyle} />
          </div>
        );
      }

      case "containers": {
        if (!activeConfig.containers.show || !hasContainers) return null;
        return (
          <div key="containers" className="space-y-0.5">
            <div className="text-[12.5px] font-black uppercase tracking-wide">
              {activeConfig.containers.title || "Returnable Containers:"}
            </div>
            {sale.containers!.plasticCrates > 0 && (
              <Row
                label={`  ${activeConfig.containers.plasticLabel || "Plastic Crates:"}`}
                value={String(sale.containers!.plasticCrates)}
                bold
              />
            )}
            {sale.containers!.glassBottles > 0 && (
              <Row
                label={`  ${activeConfig.containers.glassLabel || "Glass Bottles:"}`}
                value={String(sale.containers!.glassBottles)}
                bold
              />
            )}
            <Divider style={dividerStyle} />
          </div>
        );
      }

      case "footer": {
        if (!activeConfig.footer.show) return null;
        return (
          <div
            key="footer"
            className="text-center text-[12px] space-y-0.5 pb-2 print:pb-3"
          >
            {activeConfig.footer.thankYouNote && (
              <div className="font-black uppercase text-[13px]">
                {activeConfig.footer.thankYouNote}
              </div>
            )}
            {activeConfig.footer.policyNote && (
              <div className="font-medium text-[11.5px] leading-tight">
                {activeConfig.footer.policyNote}
              </div>
            )}
            {activeConfig.footer.showBarcodeRef && (
              <div className="font-mono text-[12px] font-bold tracking-widest pt-1">
                * {sale.invoiceNumber} *
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    /*
     * .pos-receipt-80mm is the CSS hook for print rules defined in globals.css.
     * On screen: fixed 80mm width centered, white bg.
     * On print:  76mm/72mm printable width, strong font contrast, sharp dark text for thermal head.
     */
    <div
      className={`pos-receipt-80mm bg-white text-black leading-snug
                 w-[80mm] max-w-[80mm] mx-auto
                 border border-zinc-400 rounded-lg shadow-md
                 px-[3mm] py-[3.5mm]
                 ${printWidthClass} print:border-none print:shadow-none print:rounded-none
                 print:px-[1.5mm] print:py-[2mm] print:m-0 ${baseSizeClass}`}
      style={{
        fontFamily: fontStyle,
      }}
      aria-label={`Receipt for ${sale.invoiceNumber}`}
      role="document"
    >
      {/* ── Cancellation Notice ────────────────────────────────────── */}
      {isCancelled && (
        <div className="my-[2mm] border-2 border-black text-center font-black text-xs py-[1mm]">
          <div>*** INVOICE CANCELLED ***</div>
          {sale.cancellationReason && (
            <div className="text-xs font-bold mt-[1px]">
              Reason: {sale.cancellationReason}
            </div>
          )}
        </div>
      )}

      {/* ── Dynamic Config-Ordered Sections ────────────────────────── */}
      {activeConfig.sectionOrder.map((sectionId) => renderSection(sectionId))}
    </div>
  );
}
