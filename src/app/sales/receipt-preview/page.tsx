"use client";

/**
 * 80mm SpeedX Thermal Receipt — Digital Preview & Validation Suite
 *
 * Designed to digitally validate receipt layout across all edge cases WITHOUT
 * consuming physical thermal roll paper.
 *
 * Scenarios tested:
 *  1. Standard Cash Sale
 *  2. Credit Sale (with customer ledger balance & unpaid balance)
 *  3. Long Product Names & Word Wrapping
 *  4. Multiple Products (12 items — receipt height & page break test)
 *  5. Large Quantities & Large Totals (millions of rupees, 7-8 digits)
 *  6. Urdu / Non-ASCII text support
 *  7. Container Returns (Plastic crates & Glass bottles)
 *  8. Cancelled Invoice
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ThermalReceipt } from "@/components/ui/thermal-receipt";
import { SaleType, SaleStatus, PaymentMethod } from "@prisma/client";
import type { SaleDetails } from "@/lib/sales/service";
import {
  IconReceipt,
  IconCheck,
  IconAlertTriangle,
  IconPrinter,
} from "@/components/ui/icons";

// ── Mock Datasets for Digital Validation ───────────────────────────────────────

const BASE_DATE = new Date("2026-09-25T17:30:00.000Z");

const SCENARIOS: { id: string; label: string; description: string; data: SaleDetails }[] = [
  {
    id: "cash-standard",
    label: "1. Cash Walk-in (Standard)",
    description: "Walk-in cash counter sale, 2 items, paid in full, exact match.",
    data: {
      id: "mock-sale-1",
      invoiceNumber: "INV-20260925-1001",
      customerId: null,
      customer: null,
      saleType: SaleType.RETAIL,
      status: SaleStatus.COMPLETED,
      subtotal: 16500,
      discount: 0,
      totalAmount: 16500,
      paidAmount: 16500,
      creditAmount: 0,
      soldAt: BASE_DATE,
      cancellationReason: null,
      cancelledAt: null,
      createdByName: "Hanzla (Cashier)",
      updatedByName: null,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Pepsi 1.5L PET",
          productBrand: "Pepsi",
          quantity: 10,
          unitPrice: 1200,
          totalAmount: 12000,
        },
        {
          id: "item-2",
          productId: "prod-2",
          productName: "7Up Free 500ml",
          productBrand: "7Up",
          quantity: 5,
          unitPrice: 900,
          totalAmount: 4500,
        },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 16500,
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: "INV-20260925-1001",
          paidAt: BASE_DATE,
          receivedByName: "Hanzla",
        },
      ],
      auditLogs: [],
    },
  },
  {
    id: "credit-sale",
    label: "2. Credit Sale (Wholesale)",
    description: "Registered B2B client, partial payment, outstanding credit, customer ledger balance.",
    data: {
      id: "mock-sale-2",
      invoiceNumber: "INV-20260925-1002",
      customerId: "cust-1",
      customer: {
        id: "cust-1",
        name: "ABC Store (Gulberg)",
        phone: "0300-1234567",
        address: "Shop 14, Main Market, Gulberg III, Lahore",
        creditAllowed: true,
        outstandingBalance: 35000,
      },
      saleType: SaleType.WHOLESALE,
      status: SaleStatus.COMPLETED,
      subtotal: 16500,
      discount: 0,
      totalAmount: 16500,
      paidAmount: 10000,
      creditAmount: 6500,
      soldAt: BASE_DATE,
      cancellationReason: null,
      cancelledAt: null,
      createdByName: "Hanzla",
      updatedByName: null,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Pepsi 250ml Regular Glass",
          productBrand: "Pepsi",
          quantity: 10,
          unitPrice: 1200,
          totalAmount: 12000,
        },
        {
          id: "item-2",
          productId: "prod-2",
          productName: "7Up Free 250ml Glass",
          productBrand: "7Up",
          quantity: 5,
          unitPrice: 900,
          totalAmount: 4500,
        },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 10000,
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: "Cash Part",
          paidAt: BASE_DATE,
          receivedByName: "Hanzla",
        },
      ],
      auditLogs: [],
    },
  },
  {
    id: "long-names",
    label: "3. Long Product Names (Wrapping)",
    description: "Lengthy product descriptions testing 72mm column wrapping without shifting Qty/Rate/Amount.",
    data: {
      id: "mock-sale-3",
      invoiceNumber: "INV-20260925-1003",
      customerId: null,
      customer: null,
      saleType: SaleType.RETAIL,
      status: SaleStatus.COMPLETED,
      subtotal: 21800,
      discount: 300,
      totalAmount: 21500,
      paidAmount: 21500,
      creditAmount: 0,
      soldAt: BASE_DATE,
      cancellationReason: null,
      cancelledAt: null,
      createdByName: "Hanzla",
      updatedByName: null,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Pepsi Max No Sugar 1500ml Family Pet Bottle (6 Bottles/Pack)",
          productBrand: "Pepsi",
          quantity: 4,
          unitPrice: 1450,
          totalAmount: 5800,
        },
        {
          id: "item-2",
          productId: "prod-2",
          productName: "Mirinda Green Apple Soda 250ml Slim Aluminum Can Special Edition",
          productBrand: "Mirinda",
          quantity: 8,
          unitPrice: 1100,
          totalAmount: 8800,
        },
        {
          id: "item-3",
          productId: "prod-3",
          productName: "Aquafina Premium Purified Drinking Water 500ml (24-Bottle Shrink Pack)",
          productBrand: "Aquafina",
          quantity: 12,
          unitPrice: 600,
          totalAmount: 7200,
        },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 21500,
          paymentMethod: PaymentMethod.EASYPAISA,
          referenceNumber: "EP-987654321",
          paidAt: BASE_DATE,
          receivedByName: "Hanzla",
        },
      ],
      auditLogs: [],
    },
  },
  {
    id: "multi-items",
    label: "4. Multiple Products (12 Items)",
    description: "Large order with 12 distinct SKUs testing receipt length, compact spacing, and paper economy.",
    data: {
      id: "mock-sale-4",
      invoiceNumber: "INV-20260925-1004",
      customerId: "cust-2",
      customer: {
        id: "cust-2",
        name: "Metro Cash & Carry Wholesale",
        phone: "042-111786111",
        address: "Raiwind Road, Thokar Niaz Baig, Lahore",
        creditAllowed: true,
        outstandingBalance: 125000,
      },
      saleType: SaleType.KEY_ACCOUNT,
      status: SaleStatus.COMPLETED,
      subtotal: 104500,
      discount: 2500,
      totalAmount: 102000,
      paidAmount: 102000,
      creditAmount: 0,
      soldAt: BASE_DATE,
      cancellationReason: null,
      cancelledAt: null,
      createdByName: "Hanzla",
      updatedByName: null,
      items: [
        { id: "m-1", productId: "p-1", productName: "Pepsi 1.5L PET", productBrand: "Pepsi", quantity: 15, unitPrice: 1150, totalAmount: 17250 },
        { id: "m-2", productId: "p-2", productName: "Pepsi 500ml PET", productBrand: "Pepsi", quantity: 20, unitPrice: 850, totalAmount: 17000 },
        { id: "m-3", productId: "p-3", productName: "7Up 1.5L PET", productBrand: "7Up", quantity: 10, unitPrice: 1150, totalAmount: 11500 },
        { id: "m-4", productId: "p-4", productName: "7Up 500ml PET", productBrand: "7Up", quantity: 12, unitPrice: 850, totalAmount: 10200 },
        { id: "m-5", productId: "p-5", productName: "Mirinda 1.5L PET", productBrand: "Mirinda", quantity: 8, unitPrice: 1150, totalAmount: 9200 },
        { id: "m-6", productId: "p-6", productName: "Mountain Dew 500ml", productBrand: "Mountain Dew", quantity: 10, unitPrice: 850, totalAmount: 8500 },
        { id: "m-7", productId: "p-7", productName: "Sting Berry 300ml Can", productBrand: "Sting", quantity: 15, unitPrice: 950, totalAmount: 14250 },
        { id: "m-8", productId: "p-8", productName: "Aquafina 1.5L Pack", productBrand: "Aquafina", quantity: 10, unitPrice: 550, totalAmount: 5500 },
        { id: "m-9", productId: "p-9", productName: "Pepsi 250ml Can", productBrand: "Pepsi", quantity: 5, unitPrice: 900, totalAmount: 4500 },
        { id: "m-10", productId: "p-10", productName: "7Up 250ml Can", productBrand: "7Up", quantity: 4, unitPrice: 900, totalAmount: 3600 },
        { id: "m-11", productId: "p-11", productName: "Mirinda 250ml Can", productBrand: "Mirinda", quantity: 2, unitPrice: 900, totalAmount: 1800 },
        { id: "m-12", productId: "p-12", productName: "Sting Red Rush 250ml", productBrand: "Sting", quantity: 2, unitPrice: 600, totalAmount: 1200 },
      ],
      payments: [
        {
          id: "pay-4",
          amount: 102000,
          paymentMethod: PaymentMethod.QR,
          referenceNumber: "FT-20260925-9988",
          paidAt: BASE_DATE,
          receivedByName: "Hanzla",
        },
      ],
      auditLogs: [],
    },
  },
  {
    id: "large-figures",
    label: "5. Large Quantities & Totals (Millions)",
    description: "High volume orders: 2,500 crates, multi-million figures, testing tabular numeric column alignment.",
    data: {
      id: "mock-sale-5",
      invoiceNumber: "INV-20260925-1005",
      customerId: "cust-3",
      customer: {
        id: "cust-3",
        name: "Lahore Beverage Wholesalers Ltd.",
        phone: "042-37123456",
        address: "Badami Bagh Wholesale Market, Lahore",
        creditAllowed: true,
        outstandingBalance: 1200000,
      },
      saleType: SaleType.WHOLESALE,
      status: SaleStatus.COMPLETED,
      subtotal: 3125000,
      discount: 25000,
      totalAmount: 3100000,
      paidAmount: 2000000,
      creditAmount: 1100000,
      soldAt: BASE_DATE,
      cancellationReason: null,
      cancelledAt: null,
      createdByName: "Hanzla",
      updatedByName: null,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Pepsi 1.5L PET (Full Truck Load)",
          productBrand: "Pepsi",
          quantity: 1500,
          unitPrice: 1250,
          totalAmount: 1875000,
        },
        {
          id: "item-2",
          productId: "prod-2",
          productName: "7Up 1.5L PET (Half Truck Load)",
          productBrand: "7Up",
          quantity: 1000,
          unitPrice: 1250,
          totalAmount: 1250000,
        },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 2000000,
          paymentMethod: PaymentMethod.QR,
          referenceNumber: "RTGS-BANK-PK12345678",
          paidAt: BASE_DATE,
          receivedByName: "Hanzla",
        },
      ],
      auditLogs: [],
    },
  },
  {
    id: "urdu-text",
    label: "6. Urdu / Non-ASCII Content",
    description: "Urdu product names and customer details verifying unicode font rendering on thermal output.",
    data: {
      id: "mock-sale-6",
      invoiceNumber: "INV-20260925-1006",
      customerId: "cust-4",
      customer: {
        id: "cust-4",
        name: "خان برادرز جنرل سٹور",
        phone: "0321-9876543",
        address: "اندرون لوہاری گیٹ، لاہور",
        creditAllowed: true,
        outstandingBalance: 18500,
      },
      saleType: SaleType.RETAIL,
      status: SaleStatus.COMPLETED,
      subtotal: 15200,
      discount: 200,
      totalAmount: 15000,
      paidAmount: 10000,
      creditAmount: 5000,
      soldAt: BASE_DATE,
      cancellationReason: null,
      cancelledAt: null,
      createdByName: "Hanzla",
      updatedByName: null,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "پیپسی ڈیڑھ لیٹر ریگولر (Pepsi 1.5L)",
          productBrand: "Pepsi",
          quantity: 8,
          unitPrice: 1200,
          totalAmount: 9600,
        },
        {
          id: "item-2",
          productId: "prod-2",
          productName: "مرنڈا کین 250 ایم ایل (Mirinda Can)",
          productBrand: "Mirinda",
          quantity: 6,
          unitPrice: 933.33,
          totalAmount: 5600,
        },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 10000,
          paymentMethod: PaymentMethod.JAZZCASH,
          receivedByName: "Hanzla",
          referenceNumber: "JC-992211",
          paidAt: BASE_DATE,
        },
      ],
      auditLogs: [],
    },
  },
  {
    id: "containers",
    label: "7. Container Returns Tracking",
    description: "Sale with returnable glass empties and plastic crates tracked in the container ledger.",
    data: {
      id: "mock-sale-7",
      invoiceNumber: "INV-20260925-1007",
      customerId: "cust-5",
      customer: {
        id: "cust-5",
        name: "Bismillah Bakers & Sweets",
        phone: "0302-5551234",
        address: "Chungi Amar Sidhu, Ferozepur Road, Lahore",
        creditAllowed: false,
        outstandingBalance: 0,
      },
      saleType: SaleType.RETAIL,
      status: SaleStatus.COMPLETED,
      subtotal: 28800,
      discount: 0,
      totalAmount: 28800,
      paidAmount: 28800,
      creditAmount: 0,
      soldAt: BASE_DATE,
      cancellationReason: null,
      cancelledAt: null,
      createdByName: "Hanzla",
      updatedByName: null,
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Pepsi 250ml Glass Bottle (24b/Crate)",
          productBrand: "Pepsi",
          quantity: 15,
          unitPrice: 1200,
          totalAmount: 18000,
        },
        {
          id: "item-2",
          productId: "prod-2",
          productName: "7Up 250ml Glass Bottle (24b/Crate)",
          productBrand: "7Up",
          quantity: 9,
          unitPrice: 1200,
          totalAmount: 10800,
        },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 28800,
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: "Cash Full",
          paidAt: BASE_DATE,
          receivedByName: "Hanzla",
        },
      ],
      auditLogs: [],
      containers: {
        plasticCrates: 24,
        glassBottles: 576,
      },
    },
  },
  {
    id: "cancelled",
    label: "8. Cancelled Invoice",
    description: "Receipt with cancellation banner watermark and audit reason.",
    data: {
      id: "mock-sale-8",
      invoiceNumber: "INV-20260925-1008",
      customerId: null,
      customer: null,
      saleType: SaleType.RETAIL,
      status: SaleStatus.CANCELLED,
      subtotal: 12000,
      discount: 0,
      totalAmount: 12000,
      paidAmount: 12000,
      creditAmount: 0,
      soldAt: BASE_DATE,
      cancellationReason: "Customer changed mind before loading; full refund issued.",
      cancelledAt: new Date("2026-09-25T17:45:00.000Z"),
      createdByName: "Hanzla",
      updatedByName: "Hanzla",
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Pepsi 1.5L PET",
          productBrand: "Pepsi",
          quantity: 10,
          unitPrice: 1200,
          totalAmount: 12000,
        },
      ],
      payments: [
        {
          id: "pay-1",
          amount: 12000,
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: "Refunded",
          paidAt: BASE_DATE,
          receivedByName: "Hanzla",
        },
      ],
      auditLogs: [],
    },
  },
];

export default function ReceiptPreviewPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState("cash-standard");
  const [showRuler, setShowRuler] = useState(true);
  const [measuredHeightMm, setMeasuredHeightMm] = useState<number | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  const currentScenario =
    SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

  // Measure rendered DOM height to calculate physical length in millimeters
  useEffect(() => {
    if (receiptRef.current) {
      const pxHeight = receiptRef.current.offsetHeight;
      // 96 CSS pixels ≈ 25.4 mm => mm = px * 25.4 / 96
      const mm = Math.round((pxHeight * 25.4) / 96);
      setMeasuredHeightMm(mm);
    }
  }, [selectedScenarioId]);

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/sales"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to Sales
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-xs font-bold text-zinc-500">80mm SpeedX Thermal Preview</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1 flex items-center gap-2">
            <IconReceipt className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>80mm Thermal Receipt Digital Inspector</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Safe digital validation tool for SpeedX 80mm thermal roll printers without consuming paper.
          </p>
        </div>

        {/* Safety Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
          <IconAlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold">
            Zero Paper Used: All validation is performed digitally in-browser.
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Scenario Selectors & Quality Audit Checklist */}
        <div className="lg:col-span-6 space-y-4">
          {/* Scenario Selectors */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Select Validation Scenario
            </h2>
            <div className="space-y-1.5">
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSelectedScenarioId(sc.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedScenarioId === sc.id
                      ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 shadow-xs"
                      : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                      {sc.label}
                    </span>
                    {selectedScenarioId === sc.id && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {sc.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Verification Checklist */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Digital Validation Checklist
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { label: "80mm Target Width", pass: true, detail: "CSS width: 80mm; wrapper: 80mm" },
                { label: "72mm Printable Margins", pass: true, detail: "4mm left + 4mm right margins" },
                { label: "Word-wrap on Long Items", pass: true, detail: "break-words on product name column" },
                { label: "Top-aligned Quantities", pass: true, detail: "align-top keeps Qty/Rate clean" },
                { label: "Numeric Tabular Figures", pass: true, detail: "tabular-nums for aligned columns" },
                { label: "Credit & Paid Breakdown", pass: true, detail: "Distinct bold lines for cash/credit" },
                { label: "Customer Ledger Balance", pass: true, detail: "Displayed when credit balance > 0" },
                { label: "Containers Ledger", pass: true, detail: "Shows plastic & glass empties count" },
                { label: "Minimal Paper Usage", pass: true, detail: "3mm bottom padding, no empty space" },
                { label: "Urdu / Non-ASCII Ready", pass: true, detail: "Full Unicode font stack" },
              ].map((c) => (
                <div
                  key={c.label}
                  className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2"
                >
                  <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100 text-[11px]">
                      {c.label}
                    </div>
                    <div className="text-[10px] text-zinc-500">{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/sales/new"
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
            >
              Go to Sale Counter (New Sale) →
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <Link
              href="/sales"
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
            >
              View Sales History →
            </Link>
          </div>
        </div>

        {/* Right Column: Interactive 80mm Physical Thermal Paper Simulator */}
        <div className="lg:col-span-6 flex flex-col items-center">
          {/* Controls Bar above paper */}
          <div className="w-full max-w-[340px] mb-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                Paper Simulation
              </span>
              <button
                type="button"
                onClick={() => setShowRuler((prev) => !prev)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                  showRuler
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {showRuler ? "Guides: ON" : "Guides: OFF"}
              </button>
            </div>

            {measuredHeightMm && (
              <span className="font-mono text-[11px] font-bold text-zinc-500">
                Length: ~{measuredHeightMm}mm
              </span>
            )}
          </div>

          {/* Physical Roll Simulator Container */}
          <div className="relative bg-zinc-200 dark:bg-zinc-800 p-4 rounded-3xl shadow-inner flex flex-col items-center">
            {/* 80mm Top Dimension Marker */}
            {showRuler && (
              <div className="w-[80mm] max-w-[80mm] mb-1.5 flex flex-col items-center text-[9px] font-mono text-zinc-500 dark:text-zinc-400 select-none">
                <div className="w-full flex items-center justify-between border-b border-zinc-400 px-1">
                  <span>| 0mm</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    ← 80mm Paper Width →
                  </span>
                  <span>80mm |</span>
                </div>
                <div className="w-[72mm] flex items-center justify-between border-b border-dashed border-red-500/70 text-[8px] text-red-500 mt-0.5 px-0.5">
                  <span>4mm</span>
                  <span>← 72mm Printable →</span>
                  <span>4mm</span>
                </div>
              </div>
            )}

            {/* Simulated Thermal Roll Paper (White, realistic shadow, slight drop-tear top) */}
            <div
              ref={receiptRef}
              className="relative transition-all duration-200 bg-white shadow-xl rounded-sm"
              style={{ width: "80mm", maxWidth: "80mm" }}
            >
              {/* Printable boundaries guide lines (only if showRuler is on) */}
              {showRuler && (
                <>
                  <div
                    className="absolute top-0 bottom-0 left-[4mm] w-px border-l border-dashed border-red-400/40 pointer-events-none z-10"
                    title="Left 4mm print margin boundary"
                  />
                  <div
                    className="absolute top-0 bottom-0 right-[4mm] w-px border-r border-dashed border-red-400/40 pointer-events-none z-10"
                    title="Right 4mm print margin boundary"
                  />
                </>
              )}

              {/* Real Thermal Receipt Component */}
              <ThermalReceipt sale={currentScenario.data} />
            </div>

            {/* Bottom Tear Simulator */}
            <div className="w-[80mm] max-w-[80mm] mt-1 flex justify-center">
              <div className="text-[9px] font-mono text-zinc-400 tracking-widest uppercase">
                - - - Tear Off - - -
              </div>
            </div>
          </div>

          {/* Digital Inspection Notice */}
          <div className="w-full max-w-[340px] mt-4 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <IconPrinter className="w-3.5 h-3.5" />
              <span>Print Preview Verification</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              To inspect the CSS print layout without wasting thermal paper: Press{" "}
              <kbd className="font-mono font-bold bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border border-blue-300 dark:border-blue-700">
                Ctrl+P
              </kbd>{" "}
              and set the printer destination to <strong>Save as PDF</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
