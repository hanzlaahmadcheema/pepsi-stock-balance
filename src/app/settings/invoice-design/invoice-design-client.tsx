"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ReceiptDesignConfig,
  ReceiptSectionId,
  SECTION_METADATA,
  DEFAULT_RECEIPT_CONFIG,
  setStoredReceiptConfig,
} from "@/lib/receipt/design-config";
import { saveReceiptDesignAction, resetReceiptDesignAction } from "./actions";
import { ThermalReceipt } from "@/components/ui/thermal-receipt";
import { DeveloperCredit } from "@/components/ui/developer-credit";
import { RECEIPT_SAMPLE_SCENARIOS } from "@/lib/receipt/sample-sales";
import {
  IconPrinter,
  IconCheck,
  IconAlertTriangle,
  IconArrowUp,
  IconArrowDown,
  IconChevronDown,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconSparkles,
  IconReceipt,
  IconSettings,
} from "@/components/ui/icons";

interface InvoiceDesignClientProps {
  initialConfig: ReceiptDesignConfig;
}

export function InvoiceDesignClient({ initialConfig }: InvoiceDesignClientProps) {
  const [config, setConfig] = useState<ReceiptDesignConfig>(initialConfig);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("cash-standard");
  const [zoomLevel, setZoomLevel] = useState<100 | 125>(100);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<{
    type: "idle" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  // Accordion state for expandable sections
  const [expandedSections, setExpandedSections] = useState<Record<ReceiptSectionId, boolean>>({
    header: true,
    invoiceMeta: false,
    customer: false,
    itemsTable: false,
    totals: false,
    customerLedger: false,
    containers: false,
    footer: false,
  });

  const toggleSectionAccordion = (id: ReceiptSectionId) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const currentScenario =
    RECEIPT_SAMPLE_SCENARIOS.find((s) => s.id === selectedScenarioId) ||
    RECEIPT_SAMPLE_SCENARIOS[0];

  // ── Section Ordering Handlers ──────────────────────────────────────────────────
  const moveSection = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= config.sectionOrder.length) return;

    const newOrder = [...config.sectionOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setConfig((prev) => ({ ...prev, sectionOrder: newOrder }));
    setSaveStatus({ type: "idle" });
  };

  // ── Section Visibility Toggle ──────────────────────────────────────────────────
  const toggleSectionVisibility = (id: ReceiptSectionId) => {
    setConfig((prev) => {
      switch (id) {
        case "header":
          return { ...prev, header: { ...prev.header, show: !prev.header.show } };
        case "invoiceMeta":
          return { ...prev, invoiceMeta: { ...prev.invoiceMeta, show: !prev.invoiceMeta.show } };
        case "customer":
          return { ...prev, customer: { ...prev.customer, show: !prev.customer.show } };
        case "itemsTable":
          return { ...prev, itemsTable: { ...prev.itemsTable, show: !prev.itemsTable.show } };
        case "totals":
          return { ...prev, totals: { ...prev.totals, show: !prev.totals.show } };
        case "customerLedger":
          return { ...prev, customerLedger: { ...prev.customerLedger, show: !prev.customerLedger.show } };
        case "containers":
          return { ...prev, containers: { ...prev.containers, show: !prev.containers.show } };
        case "footer":
          return { ...prev, footer: { ...prev.footer, show: !prev.footer.show } };
        default:
          return prev;
      }
    });
    setSaveStatus({ type: "idle" });
  };

  // ── Save Handlers ─────────────────────────────────────────────────────────────
  const handleSave = () => {
    startTransition(async () => {
      setSaveStatus({ type: "idle" });
      const res = await saveReceiptDesignAction(config);
      if (res.success && res.config) {
        setConfig(res.config);
        setStoredReceiptConfig(res.config);
        setSaveStatus({
          type: "success",
          message: "Receipt design successfully saved! Live sales printouts updated.",
        });
      } else {
        setSaveStatus({
          type: "error",
          message: res.error || "Failed to save design configuration.",
        });
      }
    });
  };

  const handleReset = () => {
    if (!window.confirm("Reset all receipt design settings to factory defaults?")) {
      return;
    }

    startTransition(async () => {
      const res = await resetReceiptDesignAction();
      if (res.success && res.config) {
        setConfig(res.config);
        setStoredReceiptConfig(res.config);
        setSaveStatus({
          type: "success",
          message: "Receipt design reset to factory defaults.",
        });
      } else {
        setSaveStatus({
          type: "error",
          message: res.error || "Failed to reset design configuration.",
        });
      }
    });
  };

  const handlePrintTest = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ──────────────────────────────────────────────── */}
      <div className="print:hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Link href="/settings" className="hover:underline">
                Settings
              </Link>
              <span>/</span>
              <Link href="/settings/branding" className="hover:underline">
                Branding
              </Link>
              <span>/</span>
              <span>Invoice Design</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
              <IconReceipt className="w-6 h-6 text-blue-600" />
              <span>80mm Thermal Invoice Designer</span>
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Design and reorganize modular sections for your SpeedX 80mm thermal roll receipts.
              Changes apply instantly to physical and digital invoices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrintTest}
              className="px-3.5 py-2 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              title="Open browser print preview (no paper consumed)"
            >
              <IconPrinter className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              <span>Test Print (Preview)</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="px-3.5 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/40 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <IconCheck className="w-4 h-4" />
              <span>{isPending ? "Saving..." : "Save Configuration"}</span>
            </button>
          </div>
        </div>

        {/* Status Message Banner */}
        {saveStatus.type !== "idle" && (
          <div
            className={`mt-4 p-3 rounded-xl text-sm flex items-center gap-2.5 ${
              saveStatus.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
            }`}
          >
            {saveStatus.type === "success" ? (
              <IconCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <IconAlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{saveStatus.message}</span>
          </div>
        )}
      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ===================================================================== */}
        {/* LEFT COLUMN: DESIGN CONTROLS & SECTIONS (print:hidden)                */}
        {/* ===================================================================== */}
        <div className="print:hidden lg:col-span-7 space-y-6">
          {/* Card 1: Typography & Roll Standards */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <IconSettings className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Typography & 80mm Roll Sizing
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Font Family */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Font Family
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((p) => ({
                        ...p,
                        styling: { ...p.styling, fontFamily: "sans" },
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg font-bold transition-colors cursor-pointer text-center ${
                      config.styling.fontFamily === "sans"
                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    Bold Sans-Serif
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((p) => ({
                        ...p,
                        styling: { ...p.styling, fontFamily: "mono" },
                      }))
                    }
                    className={`py-1.5 px-2 rounded-lg font-mono font-bold transition-colors cursor-pointer text-center ${
                      config.styling.fontFamily === "mono"
                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    Monospace
                  </button>
                </div>
              </div>

              {/* Base Font Size */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Font Size Density
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() =>
                        setConfig((p) => ({
                          ...p,
                          styling: { ...p.styling, baseFontSize: size },
                        }))
                      }
                      className={`py-1.5 px-1.5 rounded-lg capitalize font-bold transition-colors cursor-pointer text-center ${
                        config.styling.baseFontSize === size
                          ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                      }`}
                    >
                      {size === "small" ? "12px" : size === "medium" ? "13px (Std)" : "14px"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Printable Roll Width */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Print Width Constraint
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  {(["72mm", "76mm", "80mm"] as const).map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() =>
                        setConfig((p) => ({
                          ...p,
                          styling: { ...p.styling, printableWidth: width },
                        }))
                      }
                      className={`py-1.5 px-1.5 rounded-lg font-bold transition-colors cursor-pointer text-center ${
                        config.styling.printableWidth === width
                          ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                      }`}
                    >
                      {width === "76mm" ? "76mm (SpeedX)" : width}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider Style */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Section Divider Line
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  {(["dashed", "solid", "double"] as const).map((divStyle) => (
                    <button
                      key={divStyle}
                      type="button"
                      onClick={() =>
                        setConfig((p) => ({
                          ...p,
                          styling: { ...p.styling, dividerStyle: divStyle },
                        }))
                      }
                      className={`py-1.5 px-1 rounded-lg capitalize font-bold transition-colors cursor-pointer text-center ${
                        config.styling.dividerStyle === divStyle
                          ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                      }`}
                    >
                      {divStyle === "dashed"
                        ? "- - - Dashed"
                        : divStyle === "solid"
                        ? "—— Solid"
                        : "=== Double"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Modular Sections & Reordering */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Receipt Sections & Ordering
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Reorder sections with Up/Down buttons. Toggle switches to enable or customize details.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {config.sectionOrder.length} Modular Sections
              </span>
            </div>

            {/* List of Ordered Section Cards */}
            <div className="space-y-3">
              {config.sectionOrder.map((sectionId, idx) => {
                const meta = SECTION_METADATA[sectionId];
                const isExpanded = expandedSections[sectionId];
                const isFirst = idx === 0;
                const isLast = idx === config.sectionOrder.length - 1;

                // Section visibility boolean
                const isVisible =
                  sectionId === "header"
                    ? config.header.show
                    : sectionId === "invoiceMeta"
                    ? config.invoiceMeta.show
                    : sectionId === "customer"
                    ? config.customer.show
                    : sectionId === "itemsTable"
                    ? config.itemsTable.show
                    : sectionId === "totals"
                    ? config.totals.show
                    : sectionId === "customerLedger"
                    ? config.customerLedger.show
                    : sectionId === "containers"
                    ? config.containers.show
                    : config.footer.show;

                return (
                  <div
                    key={sectionId}
                    className={`bg-white dark:bg-zinc-900 border rounded-2xl transition-all shadow-xs ${
                      isVisible
                        ? "border-zinc-200 dark:border-zinc-800"
                        : "border-zinc-200/60 dark:border-zinc-800/50 opacity-70 bg-zinc-50/60 dark:bg-zinc-950/40"
                    }`}
                  >
                    {/* Section Card Header */}
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Up / Down Move Controls */}
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => moveSection(idx, "up")}
                            className="p-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 cursor-pointer"
                            title="Move section up"
                          >
                            <IconArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[11px] font-mono font-bold px-1 text-zinc-500">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => moveSection(idx, "down")}
                            className="p-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 cursor-pointer"
                            title="Move section down"
                          >
                            <IconArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {meta.label}
                            </span>
                            {!isVisible && (
                              <span className="text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                Hidden
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {meta.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Controls: Visibility & Expand */}
                      <div className="flex items-center gap-2">
                        {meta.canHide && (
                          <button
                            type="button"
                            onClick={() => toggleSectionVisibility(sectionId)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                              isVisible
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                            }`}
                            title={isVisible ? "Hide section from receipt" : "Show section on receipt"}
                          >
                            {isVisible ? (
                              <IconEye className="w-3.5 h-3.5" />
                            ) : (
                              <IconEyeOff className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">
                              {isVisible ? "Active" : "Disabled"}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleSectionAccordion(sectionId)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title={isExpanded ? "Collapse settings" : "Expand settings"}
                        >
                          {isExpanded ? (
                            <IconChevronDown className="w-4 h-4" />
                          ) : (
                            <IconChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Section Specific Accordion Body */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-4 text-xs">
                        {/* 1. Header Section Controls */}
                        {sectionId === "header" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                            <div className="sm:col-span-2 space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Depot / Business Name
                              </label>
                              <input
                                type="text"
                                value={config.header.businessName}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    header: { ...p.header, businessName: e.target.value },
                                  }))
                                }
                                placeholder="e.g. PEPSI REGIONAL OFFICE"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Tagline / Subtitle
                              </label>
                              <input
                                type="text"
                                value={config.header.tagline}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    header: { ...p.header, tagline: e.target.value },
                                  }))
                                }
                                placeholder="e.g. Authorized Beverage Depot"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Contact Phone
                              </label>
                              <input
                                type="text"
                                value={config.header.phone}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    header: { ...p.header, phone: e.target.value },
                                  }))
                                }
                                placeholder="e.g. 0300-1234567"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Depot Branch Address
                              </label>
                              <input
                                type="text"
                                value={config.header.address}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    header: { ...p.header, address: e.target.value },
                                  }))
                                }
                                placeholder="e.g. Industrial Area, Plot 42, Lahore"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                NTN / STRN Tax Number
                              </label>
                              <input
                                type="text"
                                value={config.header.taxNumber}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    header: { ...p.header, taxNumber: e.target.value },
                                  }))
                                }
                                placeholder="e.g. NTN: 1234567-8"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Header Alignment
                              </label>
                              <div className="flex items-center gap-2 pt-1">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium">
                                  <input
                                    type="radio"
                                    name="headerAlignment"
                                    checked={config.header.alignment === "center"}
                                    onChange={() =>
                                      setConfig((p) => ({
                                        ...p,
                                        header: { ...p.header, alignment: "center" },
                                      }))
                                    }
                                    className="text-blue-600"
                                  />
                                  <span>Center Aligned</span>
                                </label>
                                <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium ml-3">
                                  <input
                                    type="radio"
                                    name="headerAlignment"
                                    checked={config.header.alignment === "left"}
                                    onChange={() =>
                                      setConfig((p) => ({
                                        ...p,
                                        header: { ...p.header, alignment: "left" },
                                      }))
                                    }
                                    className="text-blue-600"
                                  />
                                  <span>Left Aligned</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. Invoice Meta Section Controls */}
                        {sectionId === "invoiceMeta" && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Receipt Title Banner
                              </label>
                              <input
                                type="text"
                                value={config.invoiceMeta.title}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    invoiceMeta: { ...p.invoiceMeta, title: e.target.value },
                                  }))
                                }
                                placeholder="e.g. SALES RECEIPT or TAX INVOICE"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.invoiceMeta.showInvoiceNo}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      invoiceMeta: {
                                        ...p.invoiceMeta,
                                        showInvoiceNo: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Invoice No</span>
                              </label>

                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.invoiceMeta.showDate}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      invoiceMeta: {
                                        ...p.invoiceMeta,
                                        showDate: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Date & Time</span>
                              </label>

                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.invoiceMeta.showCashier}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      invoiceMeta: {
                                        ...p.invoiceMeta,
                                        showCashier: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Cashier Name</span>
                              </label>

                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.invoiceMeta.showSaleType}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      invoiceMeta: {
                                        ...p.invoiceMeta,
                                        showSaleType: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Sale Type</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* 3. Customer Section Controls */}
                        {sectionId === "customer" && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Default Walk-in Customer Label
                              </label>
                              <input
                                type="text"
                                value={config.customer.walkInLabel}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    customer: { ...p.customer, walkInLabel: e.target.value },
                                  }))
                                }
                                placeholder="e.g. WALK-IN / CASH"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.customer.showCustomerName}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      customer: {
                                        ...p.customer,
                                        showCustomerName: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Customer Name</span>
                              </label>

                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.customer.showPhone}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      customer: {
                                        ...p.customer,
                                        showPhone: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Customer Phone</span>
                              </label>

                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.customer.showAddress}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      customer: {
                                        ...p.customer,
                                        showAddress: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Customer Address</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* 4. Items Table Section Controls */}
                        {sectionId === "itemsTable" && (
                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                                Visible Columns
                              </label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={config.itemsTable.showItemName}
                                    onChange={(e) =>
                                      setConfig((p) => ({
                                        ...p,
                                        itemsTable: {
                                          ...p.itemsTable,
                                          showItemName: e.target.checked,
                                        },
                                      }))
                                    }
                                    className="rounded text-blue-600"
                                  />
                                  <span className="font-semibold">Product Name</span>
                                </label>

                                <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={config.itemsTable.showQty}
                                    onChange={(e) =>
                                      setConfig((p) => ({
                                        ...p,
                                        itemsTable: {
                                          ...p.itemsTable,
                                          showQty: e.target.checked,
                                        },
                                      }))
                                    }
                                    className="rounded text-blue-600"
                                  />
                                  <span className="font-semibold">Qty (Crates)</span>
                                </label>

                                <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={config.itemsTable.showRate}
                                    onChange={(e) =>
                                      setConfig((p) => ({
                                        ...p,
                                        itemsTable: {
                                          ...p.itemsTable,
                                          showRate: e.target.checked,
                                        },
                                      }))
                                    }
                                    className="rounded text-blue-600"
                                  />
                                  <span className="font-semibold">Rate (Unit)</span>
                                </label>

                                <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={config.itemsTable.showAmount}
                                    onChange={(e) =>
                                      setConfig((p) => ({
                                        ...p,
                                        itemsTable: {
                                          ...p.itemsTable,
                                          showAmount: e.target.checked,
                                        },
                                      }))
                                    }
                                    className="rounded text-blue-600"
                                  />
                                  <span className="font-semibold">Line Amount</span>
                                </label>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div className="space-y-1">
                                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                  Row Spacing Density
                                </label>
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfig((p) => ({
                                        ...p,
                                        itemsTable: { ...p.itemsTable, rowSpacing: "compact" },
                                      }))
                                    }
                                    className={`py-1 rounded font-bold transition-colors cursor-pointer text-center ${
                                      config.itemsTable.rowSpacing === "compact"
                                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                                        : "text-zinc-600 dark:text-zinc-400"
                                    }`}
                                  >
                                    Compact (Saves Paper)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfig((p) => ({
                                        ...p,
                                        itemsTable: { ...p.itemsTable, rowSpacing: "normal" },
                                      }))
                                    }
                                    className={`py-1 rounded font-bold transition-colors cursor-pointer text-center ${
                                      config.itemsTable.rowSpacing === "normal"
                                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                                        : "text-zinc-600 dark:text-zinc-400"
                                    }`}
                                  >
                                    Comfortable
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                  Divider Between Items
                                </label>
                                <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                  {(["dashed", "solid", "none"] as const).map((d) => (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() =>
                                        setConfig((p) => ({
                                          ...p,
                                          itemsTable: { ...p.itemsTable, itemDivider: d },
                                        }))
                                      }
                                      className={`py-1 rounded font-bold capitalize transition-colors cursor-pointer text-center ${
                                        config.itemsTable.itemDivider === d
                                          ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                                          : "text-zinc-600 dark:text-zinc-400"
                                      }`}
                                    >
                                      {d}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 5. Financial Totals Controls */}
                        {sectionId === "totals" && (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                  Total Row Label
                                </label>
                                <input
                                  type="text"
                                  value={config.totals.totalLabel}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      totals: { ...p.totals, totalLabel: e.target.value },
                                    }))
                                  }
                                  placeholder="TOTAL"
                                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                  Paid Amount Label
                                </label>
                                <input
                                  type="text"
                                  value={config.totals.paidLabel}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      totals: { ...p.totals, paidLabel: e.target.value },
                                    }))
                                  }
                                  placeholder="PAID"
                                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                  Credit Balance Label
                                </label>
                                <input
                                  type="text"
                                  value={config.totals.creditLabel}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      totals: { ...p.totals, creditLabel: e.target.value },
                                    }))
                                  }
                                  placeholder="CREDIT"
                                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                  Zero Balance Label
                                </label>
                                <input
                                  type="text"
                                  value={config.totals.balancePaidFullLabel}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      totals: {
                                        ...p.totals,
                                        balancePaidFullLabel: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="0 (PAID FULL)"
                                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.totals.showSubtotal}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      totals: { ...p.totals, showSubtotal: e.target.checked },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Subtotal</span>
                              </label>

                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.totals.showDiscount}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      totals: { ...p.totals, showDiscount: e.target.checked },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Discount</span>
                              </label>

                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.totals.showPaid}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      totals: { ...p.totals, showPaid: e.target.checked },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Paid Amount</span>
                              </label>

                              <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={config.totals.showPaymentMethod}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      totals: {
                                        ...p.totals,
                                        showPaymentMethod: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold">Payment Mode</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* 6. Customer Ledger Controls */}
                        {sectionId === "customerLedger" && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Ledger Section Label
                              </label>
                              <input
                                type="text"
                                value={config.customerLedger.label}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    customerLedger: {
                                      ...p.customerLedger,
                                      label: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Customer Ledger:"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={config.customerLedger.showOnlyIfBalance}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    customerLedger: {
                                      ...p.customerLedger,
                                      showOnlyIfBalance: e.target.checked,
                                    },
                                  }))
                                }
                                className="rounded text-blue-600"
                              />
                              <span className="font-semibold">
                                Show only when customer has an outstanding balance &gt; 0
                              </span>
                            </label>
                          </div>
                        )}

                        {/* 7. Containers Section Controls */}
                        {sectionId === "containers" && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Section Heading
                              </label>
                              <input
                                type="text"
                                value={config.containers.title}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    containers: { ...p.containers, title: e.target.value },
                                  }))
                                }
                                placeholder="Returnable Containers:"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                  Plastic Crates Label
                                </label>
                                <input
                                  type="text"
                                  value={config.containers.plasticLabel}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      containers: {
                                        ...p.containers,
                                        plasticLabel: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Plastic Crates:"
                                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                  Glass Bottles Label
                                </label>
                                <input
                                  type="text"
                                  value={config.containers.glassLabel}
                                  onChange={(e) =>
                                    setConfig((p) => ({
                                      ...p,
                                      containers: {
                                        ...p.containers,
                                        glassLabel: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Glass Bottles:"
                                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 8. Footer Section Controls */}
                        {sectionId === "footer" && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Thank You Message
                              </label>
                              <input
                                type="text"
                                value={config.footer.thankYouNote}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    footer: { ...p.footer, thankYouNote: e.target.value },
                                  }))
                                }
                                placeholder="Thank you for your business!"
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                                Return Policy / Legal Terms
                              </label>
                              <textarea
                                rows={2}
                                value={config.footer.policyNote}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    footer: { ...p.footer, policyNote: e.target.value },
                                  }))
                                }
                                placeholder="Goods dispatched non-refundable without slip."
                                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={config.footer.showBarcodeRef}
                                onChange={(e) =>
                                  setConfig((p) => ({
                                    ...p,
                                    footer: {
                                      ...p.footer,
                                      showBarcodeRef: e.target.checked,
                                    },
                                  }))
                                }
                                className="rounded text-blue-600"
                              />
                              <span className="font-semibold">
                                Show Invoice Number Reference (* INV-1001 *)
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* RIGHT COLUMN: STICKY LIVE 80MM THERMAL RECEIPT PREVIEW                */}
        {/* ===================================================================== */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            {/* Live Preview Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                    Live 80mm Roll Preview
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Instant visual feedback as sections and settings change
                </p>
              </div>

              {/* Zoom Buttons */}
              <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                    zoomLevel === 100
                      ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(125)}
                  className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                    zoomLevel === 125
                      ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  125% Zoom
                </button>
              </div>
            </div>

            {/* Scenario Switcher Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                Sample Test Dataset:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RECEIPT_SAMPLE_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSelectedScenarioId(sc.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedScenarioId === sc.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {sc.label.split(". ")[1] || sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Realistic Thermal Paper Roll Container */}
            <div className="bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-center items-start overflow-x-auto min-h-[460px]">
              <div
                style={{
                  transform: zoomLevel === 125 ? "scale(1.25)" : "scale(1)",
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease",
                }}
                className="my-1"
              >
                {/* Physical Receipt Component with Active Custom Config */}
                <ThermalReceipt sale={currentScenario.data} config={config} />
              </div>
            </div>

            {/* Bottom info note */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <IconSparkles className="w-3.5 h-3.5" />
                <span>SpeedX 80mm Compatibility</span>
              </div>
              <p className="leading-relaxed">
                Standard SpeedX thermal rolls use a 76mm printable surface. All fonts are
                optimized for bold thermal head contrast to avoid faint printouts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Developer Credit Footer */}
      <DeveloperCredit variant="footer" className="print:hidden" />
    </div>
  );
}
