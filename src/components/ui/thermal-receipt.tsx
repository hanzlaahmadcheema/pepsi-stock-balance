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

/** Dashed divider — renders the same on screen and paper */
function Divider({ double = false }: { double?: boolean }) {
  return (
    <div
      className={`my-1 ${double ? "border-t-2 border-b-2 border-black py-px" : "border-t border-dashed border-black"}`}
      aria-hidden="true"
    />
  );
}

/** One row with left label and right value, both plain text */
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
    <div className={`flex justify-between leading-tight ${bold ? "font-bold" : ""} ${className}`}>
      <span>{label}</span>
      <span className="text-right ml-2 tabular-nums">{value}</span>
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
     * On screen: fixed 80mm width centered, white bg, monospace font.
     * On print:  72mm printable width, no border/shadow, 2mm top pad.
     */
    <div
      className="pos-receipt-80mm bg-white text-black font-mono text-[10.5px] leading-snug
                 w-[80mm] max-w-[80mm] mx-auto
                 border border-zinc-300 rounded-lg shadow-md
                 px-[3mm] py-[3mm]
                 print:border-none print:shadow-none print:rounded-none
                 print:px-[1mm] print:py-[2mm] print:m-0"
      aria-label={`Receipt for ${sale.invoiceNumber}`}
      role="document"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="text-center leading-tight space-y-[1px] pb-[2mm]">
        <div className="text-xs font-black tracking-tight uppercase">
          {DEPOT_NAME}
        </div>
        <div className="text-xs uppercase tracking-wide font-semibold">
          {DEPOT_TAGLINE}
        </div>
        <div className="text-xs">SALES RECEIPT</div>
      </div>

      <Divider />

      {/* ── Cancellation Notice ────────────────────────────────────── */}
      {isCancelled && (
        <div className="my-[2mm] border-2 border-black text-center font-black text-xs py-[1mm]">
          <div>*** INVOICE CANCELLED ***</div>
          {sale.cancellationReason && (
            <div className="text-xs font-normal mt-[1px]">
              Reason: {sale.cancellationReason}
            </div>
          )}
        </div>
      )}

      {/* ── Invoice Meta ───────────────────────────────────────────── */}
      <div className="space-y-[1px]">
        <Row label="Invoice:" value={sale.invoiceNumber} bold />
        <Row label="Date:" value={formatReceiptDate(sale.soldAt)} />
        <Row label="Cashier:" value={sale.createdByName} />
        <Row label="Type:" value={sale.saleType.replace(/_/g, " ")} />
      </div>

      <Divider />

      {/* ── Customer ───────────────────────────────────────────────── */}
      <div className="space-y-[1px]">
        <div className="font-bold">
          {sale.customer ? sale.customer.name : "WALK-IN / CASH"}
        </div>
        {sale.customer?.phone && (
          <div className="text-xs">Ph: {sale.customer.phone}</div>
        )}
        {sale.customer?.address && (
          <div className="text-xs break-words">{sale.customer.address}</div>
        )}
      </div>

      <Divider />

      {/* ── Items Table ────────────────────────────────────────────── */}
      {/*
       * Column layout (72mm printable ≈ 28 chars at 10.5px mono):
       *   Product name  — full width, wraps freely on second line
       *   Qty × Rate    Amount  (indented sub-line)
       *
       * This 2-line-per-item layout is the ESC/POS 80mm standard for
       * long product names. It avoids truncation and fits all cases.
       */}
      <div className="space-y-[1.5px]">
        {/* Column header */}
        <div className="flex justify-between font-bold text-xs uppercase border-b border-black pb-[1px]">
          <span>Item</span>
          <span>Amt (Rs.)</span>
        </div>

        {sale.items.map((item) => (
          <div key={item.id} className="py-[1px]">
            {/* Line 1: Product name — wraps if long */}
            <div className="font-semibold break-words leading-tight">
              {item.productName}
            </div>
            {/* Line 2: Qty × Rate → Amount (indented) */}
            <div className="flex justify-between pl-[2mm] text-[9.5px]">
              <span>
                {formatCrates(item.quantity)} crt × {amt(item.unitPrice)}
              </span>
              <span className="font-bold tabular-nums">
                {amt(item.totalAmount)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Financial Totals ───────────────────────────────────────── */}
      <Divider />
      <div className="space-y-[1.5px]">
        {hasDiscount && (
          <>
            <Row
              label={`Subtotal (${sale.items.reduce((a, i) => a + i.quantity, 0)} crates):`}
              value={`Rs. ${amt(sale.subtotal)}`}
            />
            <Row
              label="Discount:"
              value={`- Rs. ${amt(sale.discount)}`}
            />
          </>
        )}

        {/* Double-rule total — the most prominent line */}
        <div className="flex justify-between font-black text-xs leading-tight border-t-2 border-b-2 border-black py-[1px] my-[1mm]">
          <span>TOTAL</span>
          <span className="tabular-nums">Rs. {amt(sale.totalAmount)}</span>
        </div>

        <Row
          label="Paid:"
          value={`Rs. ${amt(sale.paidAmount)}`}
          bold
        />

        {hasCredit && (
          <Row
            label="Credit Due:"
            value={`Rs. ${amt(sale.creditAmount)}`}
            bold
            className="font-black"
          />
        )}

        {!hasCredit && (
          <Row label="Balance:" value="Rs. 0  (PAID FULL)" />
        )}

        <Row label="Payment:" value={paymentMethodDisplay} />
      </div>

      {/* ── Customer Ledger Outstanding ────────────────────────────── */}
      {sale.customer && sale.customer.outstandingBalance > 0 && (
        <>
          <Divider />
          <Row
            label="A/c Ledger Balance:"
            value={`Rs. ${amt(sale.customer.outstandingBalance)}`}
            bold
          />
        </>
      )}

      {/* ── Container Section ──────────────────────────────────────── */}
      {hasContainers && (
        <>
          <Divider />
          <div className="space-y-[1px]">
            <div className="text-xs font-bold uppercase tracking-wide">
              Returnable Containers:
            </div>
            {sale.containers!.plasticCrates > 0 && (
              <Row
                label="  Plastic Crates:"
                value={String(sale.containers!.plasticCrates)}
              />
            )}
            {sale.containers!.glassBottles > 0 && (
              <Row
                label="  Glass Bottles:"
                value={String(sale.containers!.glassBottles)}
              />
            )}
          </div>
        </>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Divider />
      <div className="text-center text-xs space-y-[1px] pb-[8mm] print:pb-[12mm]">
        <div className="font-bold uppercase">{DEPOT_FOOTER_THANK}</div>
        <div>{DEPOT_FOOTER_LINE}</div>
        {/* Barcode-style invoice number reference */}
        <div className="font-mono text-xs tracking-widest pt-[1mm] opacity-70">
          * {sale.invoiceNumber} *
        </div>
      </div>
    </div>
  );
}
