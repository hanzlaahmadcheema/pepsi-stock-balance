"use client";

/**
 * ThermalReceipt — Isolated 80mm thermal roll receipt component.
 *
 * Designed for SpeedX (and compatible) 80mm thermal printers.
 * Printable width: 72mm (80mm roll minus ~4mm each side).
 * Font: monospace for consistent character-width alignment.
 *
 * Usage:
 *  - On-screen: renders inside `.pos-receipt-80mm` wrapper at fixed 80mm width.
 *  - Print:  `@media print` in globals.css sets `@page { size: 80mm auto }` and
 *            constrains `.pos-receipt-80mm` to 72mm printable width.
 *
 * Isolation contract:
 *  - Does NOT import or call any Next.js router/navigation hooks.
 *  - Does NOT trigger window.print() — that is the caller's responsibility.
 *  - All layout decisions are self-contained in this file.
 *  - Changing receipt layout does NOT affect any other sales UI.
 */

import { formatCurrency, formatCrates } from "@/lib/formatters";
import type { SaleDetails } from "@/lib/sales/service";

// ── Constants ──────────────────────────────────────────────────────────────────
const DEPOT_NAME = "PEPSI REGIONAL OFFICE";
const DEPOT_TAGLINE = "Authorized Beverage Depot";
const DEPOT_FOOTER_LINE = "Goods dispatched non-refundable without slip.";
const DEPOT_FOOTER_THANK = "Thank you for your business!";

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

/** Dashed divider — renders boldly on screen and thermal paper */
function Divider({ double = false }: { double?: boolean }) {
  return (
    <div
      className={`my-1.5 ${double ? "border-t-2 border-b-2 border-black py-0.5" : "border-t-2 border-dashed border-black"}`}
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
    <div className={`flex justify-between leading-snug text-[13px] ${bold ? "font-bold" : "font-medium"} ${className}`}>
      <span>{label}</span>
      <span className="text-right ml-2 tabular-nums font-bold">{value}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export interface ThermalReceiptProps {
  sale: SaleDetails;
}

export function ThermalReceipt({ sale }: ThermalReceiptProps) {
  const isCancelled = sale.status === "CANCELLED";
  const hasDiscount = sale.discount > 0;
  const hasCredit = sale.creditAmount > 0;
  const hasContainers =
    sale.containers &&
    (sale.containers.plasticCrates > 0 || sale.containers.glassBottles > 0);

  const primaryPayment = sale.payments[0];
  const paymentMethodDisplay = primaryPayment
    ? primaryPayment.paymentMethod.replace(/_/g, " ")
    : "—";

  return (
    /*
     * .pos-receipt-80mm is the CSS hook for print rules defined in globals.css.
     * On screen: fixed 80mm width centered, white bg.
     * On print:  76mm printable width, strong font contrast, sharp dark text for thermal head.
     */
    <div
      className="pos-receipt-80mm bg-white text-black text-[13px] leading-snug
                 w-[80mm] max-w-[80mm] mx-auto
                 border border-zinc-400 rounded-lg shadow-md
                 px-[3mm] py-[3.5mm]
                 print:w-[76mm] print:max-w-[76mm] print:border-none print:shadow-none print:rounded-none
                 print:px-[1.5mm] print:py-[2mm] print:m-0"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      }}
      aria-label={`Receipt for ${sale.invoiceNumber}`}
      role="document"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="text-center leading-tight space-y-0.5 pb-1">
        <div className="text-[17px] font-black tracking-tight uppercase">
          {DEPOT_NAME}
        </div>
        <div className="text-[12px] uppercase tracking-wide font-bold">
          {DEPOT_TAGLINE}
        </div>
        <div className="text-[13px] font-extrabold tracking-wider mt-0.5">SALES RECEIPT</div>
      </div>

      <Divider />

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

      {/* ── Invoice Meta ───────────────────────────────────────────── */}
      <div className="space-y-0.5 text-[13px]">
        <Row label="Invoice:" value={sale.invoiceNumber} bold className="text-[14px]" />
        <Row label="Date:" value={formatReceiptDate(sale.soldAt)} />
        <Row label="Cashier:" value={sale.createdByName} />
        <Row label="Type:" value={sale.saleType.replace(/_/g, " ")} />
      </div>

      <Divider />

      {/* ── Customer ───────────────────────────────────────────────── */}
      <div className="space-y-0.5 text-[13px]">
        <div className="font-black text-[14px] uppercase">
          {sale.customer ? sale.customer.name : "WALK-IN / CASH"}
        </div>
        {sale.customer?.phone && (
          <div className="text-[12px] font-bold">Ph: {sale.customer.phone}</div>
        )}
        {sale.customer?.address && (
          <div className="text-[12px] font-medium break-words">{sale.customer.address}</div>
        )}
      </div>

      <Divider />

      {/* ── Items Table ────────────────────────────────────────────── */}
      {/*
       * 4-column layout matching SpeedX 80mm thermal receipt standard:
       *   Item (left, wraps cleanly) | Qty (right) | Rate (right) | Amount (right)
       */}
      <div className="space-y-1">
        <table className="w-full text-[13px] leading-tight border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-[12px] uppercase font-black">
              <th className="text-left pb-1 font-black">Item</th>
              <th className="text-right pb-1 font-black pl-1">Qty</th>
              <th className="text-right pb-1 font-black pl-1">Rate</th>
              <th className="text-right pb-1 font-black pl-1">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-zinc-400 print:divide-black">
            {sale.items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="text-left py-1 pr-1 font-bold break-words leading-tight text-[12.5px]">
                  {item.productName}
                </td>
                <td className="text-right py-1 pl-1 tabular-nums whitespace-nowrap font-bold text-[13px]">
                  {formatCrates(item.quantity)}
                </td>
                <td className="text-right py-1 pl-1 tabular-nums whitespace-nowrap font-medium text-[13px]">
                  {amt(item.unitPrice)}
                </td>
                <td className="text-right py-1 pl-1 tabular-nums whitespace-nowrap font-black text-[13px]">
                  {amt(item.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Financial Totals ───────────────────────────────────────── */}
      <Divider />
      <div className="space-y-1 text-[13px]">
        {hasDiscount && (
          <>
            <Row
              label={`Subtotal (${sale.items.reduce((a, i) => a + i.quantity, 0)} crates):`}
              value={amt(sale.subtotal)}
            />
            <Row
              label="Discount:"
              value={`-${amt(sale.discount)}`}
            />
          </>
        )}

        {/* Prominent Total Line */}
        <div className="flex justify-between font-black text-[17px] leading-tight border-t-2 border-b-2 border-black py-1 my-1">
          <span className="uppercase">TOTAL</span>
          <span className="tabular-nums font-black">{amt(sale.totalAmount)}</span>
        </div>

        <Row
          label="PAID"
          value={amt(sale.paidAmount)}
          bold
          className="text-[14px]"
        />

        {hasCredit && (
          <Row
            label="CREDIT"
            value={amt(sale.creditAmount)}
            bold
            className="text-[14px] font-black"
          />
        )}

        {!hasCredit && (
          <Row label="BALANCE" value="0 (PAID FULL)" />
        )}

        <Row label="Payment:" value={paymentMethodDisplay} />
      </div>

      {/* ── Customer Ledger Outstanding ────────────────────────────── */}
      {sale.customer && sale.customer.outstandingBalance > 0 && (
        <>
          <Divider />
          <Row
            label="Customer Ledger:"
            value={amt(sale.customer.outstandingBalance)}
            bold
            className="text-[14px] font-black"
          />
        </>
      )}

      {/* ── Container Section ──────────────────────────────────────── */}
      {hasContainers && (
        <>
          <Divider />
          <div className="space-y-0.5 text-[13px]">
            <div className="text-[12.5px] font-black uppercase tracking-wide">
              Returnable Containers:
            </div>
            {sale.containers!.plasticCrates > 0 && (
              <Row
                label="  Plastic Crates:"
                value={String(sale.containers!.plasticCrates)}
                bold
              />
            )}
            {sale.containers!.glassBottles > 0 && (
              <Row
                label="  Glass Bottles:"
                value={String(sale.containers!.glassBottles)}
                bold
              />
            )}
          </div>
        </>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Divider />
      <div className="text-center text-[12px] space-y-0.5 pb-2 print:pb-3">
        <div className="font-black uppercase text-[13px]">{DEPOT_FOOTER_THANK}</div>
        <div className="font-medium text-[11.5px]">{DEPOT_FOOTER_LINE}</div>
        {/* Barcode-style invoice number reference */}
        <div className="font-mono text-[12px] font-bold tracking-widest pt-1">
          * {sale.invoiceNumber} *
        </div>
      </div>
    </div>
  );
}
