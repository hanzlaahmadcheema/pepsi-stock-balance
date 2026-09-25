"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import {
  updateContainerTypesAction,
  updateBulkProductCratesAction,
} from "./actions";
import type { ContainerSettings } from "@/lib/containers/settings-service";
import {
  IconPackage,
  IconCheck,
  IconSearch,
  IconAlertTriangle,
  IconBottle,
  IconBox,
  IconClose,
  IconDollarSign,
  IconSettings,
  IconReceipt,
  IconSparkles,
} from "@/components/ui/icons";
import { DeveloperCredit } from "@/components/ui/developer-credit";
import { isCloudPortal } from "@/lib/config/portal-mode";

interface ProductWithCrate {
  id: string;
  name: string;
  brand: string;
  sku: string | null;
  hasGlassCrate: boolean;
  bottlesPerCrate: number;
}

export function CrateSettingsClient({
  settings,
  initialProducts,
}: {
  settings: ContainerSettings;
  initialProducts: ProductWithCrate[];
}) {
  const isCloud = isCloudPortal();
  const [typesState, typesAction, isTypesPending] = useActionState(
    updateContainerTypesAction,
    null
  );
  const [bulkState, bulkAction, isBulkPending] = useActionState(
    updateBulkProductCratesAction,
    null
  );

  // Rate tiers state (Owner can use 1 or more)
  const [retailRate, setRetailRate] = useState(settings.enabledRates?.retail ?? true);
  const [wholesaleRate, setWholesaleRate] = useState(settings.enabledRates?.wholesale ?? true);
  const [keyRate, setKeyRate] = useState(settings.enabledRates?.key ?? true);
  const [rateWarning, setRateWarning] = useState<string | null>(null);

  // Container types & capacity
  const [glassEnabled, setGlassEnabled] = useState(settings.enabledTypes.glass);
  const [plasticEnabled, setPlasticEnabled] = useState(settings.enabledTypes.plastic);
  const [defaultBottles, setDefaultBottles] = useState(settings.defaultBottlesPerCrate ?? 24);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");

  // Local state for product configs (only returnable flag tracked; bottle count from setting)
  const [productConfigs, setProductConfigs] = useState<Record<string, { hasGlassCrate: boolean; bottlesPerCrate: number }>>(() => {
    const map: Record<string, { hasGlassCrate: boolean; bottlesPerCrate: number }> = {};
    for (const p of initialProducts) {
      map[p.id] = {
        hasGlassCrate: p.hasGlassCrate,
        bottlesPerCrate: defaultBottles,
      };
    }
    return map;
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleToggleRate = (tier: "retail" | "wholesale" | "key") => {
    if (isCloud) return;
    setRateWarning(null);
    let nextRetail = retailRate;
    let nextWholesale = wholesaleRate;
    let nextKey = keyRate;

    if (tier === "retail") nextRetail = !retailRate;
    if (tier === "wholesale") nextWholesale = !wholesaleRate;
    if (tier === "key") nextKey = !keyRate;

    // At least one rate must remain active
    if (!nextRetail && !nextWholesale && !nextKey) {
      setRateWarning("At least one display rate (Retail, Wholesale, or Key) must remain active.");
      return;
    }

    setRetailRate(nextRetail);
    setWholesaleRate(nextWholesale);
    setKeyRate(nextKey);
  };

  const handleToggleGlassCrate = (productId: string) => {
    if (isCloud) return;
    setProductConfigs((prev) => {
      const cur = prev[productId] || { hasGlassCrate: true, bottlesPerCrate: defaultBottles };
      const next = {
        ...prev,
        [productId]: {
          ...cur,
          hasGlassCrate: !cur.hasGlassCrate,
          bottlesPerCrate: defaultBottles,
        },
      };
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const handleBulkSetAll = (hasGlass: boolean) => {
    if (isCloud) return;
    setProductConfigs((prev) => {
      const next = { ...prev };
      for (const p of filteredProducts) {
        next[p.id] = {
          hasGlassCrate: hasGlass,
          bottlesPerCrate: defaultBottles,
        };
      }
      setHasUnsavedChanges(true);
      return next;
    });
  };

  // Unique brands
  const brands = Array.from(new Set(initialProducts.map((p) => p.brand))).sort();

  // Filtered list
  const filteredProducts = initialProducts.filter((p) => {
    const matchBrand = brandFilter === "ALL" || p.brand.toLowerCase() === brandFilter.toLowerCase();
    const matchSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchBrand && matchSearch;
  });

  const totalReturnable = Object.values(productConfigs).filter((c) => c.hasGlassCrate).length;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
              Owner Management
            </span>
            {isCloud && (
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Read-Only
              </span>
            )}
            <span className="text-xs text-zinc-500">
              Core Operation: <strong className="text-zinc-700 dark:text-zinc-300">Glass &amp; Returnable Depot</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
            <IconSettings className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <span>Settings</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {isCloud
              ? "View active application display rates, standard crate bottle capacity, and returnable container configurations."
              : "Manage application display rates (\"Retail, Wholesale, Key\"), standard crate bottle capacity, and returnable container policies."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/settings/branding"
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition flex items-center gap-1.5"
          >
            <IconSparkles className="w-3.5 h-3.5" />
            <span>Business Branding</span>
          </Link>
          <Link
            href="/settings/invoice-design"
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex items-center gap-1.5"
          >
            <IconReceipt className="w-3.5 h-3.5" />
            <span>Invoice Design</span>
          </Link>
          <Link
            href="/products"
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            ← View Products Catalog
          </Link>
        </div>
      </div>

      {isCloud && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 text-xs font-semibold flex items-center gap-2">
          <IconSettings className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            Application display rates, standard bottle capacities, and returnable crate flags are configured on the local Windows Depot terminal. This portal view is strictly read-only.
          </span>
        </div>
      )}

      {/* Notifications */}
      {(typesState?.success || bulkState?.success) && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold text-xs flex items-center gap-2">
          <IconCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{typesState?.message || bulkState?.message}</span>
        </div>
      )}
      {(typesState?.error || bulkState?.error || rateWarning) && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 font-semibold text-xs flex items-center gap-2">
          <IconAlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{rateWarning || typesState?.error || bulkState?.error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. APPLICATION DISPLAY RATES & PACKAGING FORM            */}
      {/* ========================================================= */}
      <form action={typesAction} className="space-y-6">
        <input type="hidden" name="glassEnabled" value={String(glassEnabled)} />
        <input type="hidden" name="plasticEnabled" value={String(plasticEnabled)} />
        <input type="hidden" name="retailRate" value={String(retailRate)} />
        <input type="hidden" name="wholesaleRate" value={String(wholesaleRate)} />
        <input type="hidden" name="keyRate" value={String(keyRate)} />

        {/* Display Rates Panel */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <IconDollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Application Display Rates (&quot;Retail, Wholesale, Key&quot;)</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Control which price tiers appear in POS sales, customer accounts, and product pricing. Owner can use 1 or more rates.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 self-start sm:self-auto">
              <span>Active Rates:</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {[retailRate && "Retail", wholesaleRate && "Wholesale", keyRate && "Key"].filter(Boolean).join(", ") || "None"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Retail Rate Tier */}
            <div
              onClick={() => handleToggleRate("retail")}
              className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                retailRate
                  ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-400 dark:border-blue-800 ring-2 ring-blue-500/20 shadow-xs"
                  : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 opacity-60 hover:opacity-80"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    retailRate ? "bg-blue-600 text-white" : "bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}>
                    R
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Retail Rate
                    </h3>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Standard Pricing
                    </span>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs ${
                  retailRate ? "bg-blue-600 text-white" : "border border-zinc-300 dark:border-zinc-600"
                }`}>
                  {retailRate && <IconCheck className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Primary counter and walk-in cash customer rate. Displayed on POS invoice tickets and general catalog.
              </p>
            </div>

            {/* Wholesale Rate Tier */}
            <div
              onClick={() => handleToggleRate("wholesale")}
              className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                wholesaleRate
                  ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-400 dark:border-purple-800 ring-2 ring-purple-500/20 shadow-xs"
                  : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 opacity-60 hover:opacity-80"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    wholesaleRate ? "bg-purple-600 text-white" : "bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}>
                    W
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Wholesale Rate
                    </h3>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Bulk Distributors
                    </span>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs ${
                  wholesaleRate ? "bg-purple-600 text-white" : "border border-zinc-300 dark:border-zinc-600"
                }`}>
                  {wholesaleRate && <IconCheck className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Discounted crate rates for regional retail shops and high-volume beverage re-sellers.
              </p>
            </div>

            {/* Key Account Rate Tier */}
            <div
              onClick={() => handleToggleRate("key")}
              className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                keyRate
                  ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-400 dark:border-amber-800 ring-2 ring-amber-500/20 shadow-xs"
                  : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 opacity-60 hover:opacity-80"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    keyRate ? "bg-amber-600 text-white" : "bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}>
                    K
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Key Account Rate
                    </h3>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Institutions &amp; VIP
                    </span>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs ${
                  keyRate ? "bg-amber-600 text-white" : "border border-zinc-300 dark:border-zinc-600"
                }`}>
                  {keyRate && <IconCheck className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Special contract pricing for institutional clients, hotel chains, and marquee corporate accounts.
              </p>
            </div>
          </div>
        </div>

        {/* Crate Packaging & Containers Panel */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <IconPackage className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Crate Packaging &amp; Bottle Quantities</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure standard bottle quantity per crate and active container tracking categories.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Glass Bottles & Crates (Active Core) */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                glassEnabled
                  ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 ring-2 ring-blue-500/20"
                  : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    <IconBottle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Returnable Glass Bottles &amp; Crates
                    </h3>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                      Core Operations (Active)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setGlassEnabled(!glassEnabled)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    glassEnabled
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {glassEnabled ? (
                    <span className="inline-flex items-center gap-1">
                      <IconCheck className="w-3.5 h-3.5" />
                      <span>Enabled</span>
                    </span>
                  ) : (
                    "Disabled"
                  )}
                </button>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
                Tracks returnable glass bottle crates (240ml, 250ml, 300ml, 1L). Customers are debited for glass crates dispatched and credited when empties are returned.
              </p>
            </div>

            {/* Plastic Crates (Disabled by default, preserved in database) */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                plasticEnabled
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/20"
                  : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
                    plasticEnabled ? "bg-emerald-600 text-white" : "bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}>
                    <IconBox className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Plastic Crates Only
                    </h3>
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      plasticEnabled ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-500"
                    }`}>
                      {plasticEnabled ? "Active in Forms" : "Disabled (Not Deleted)"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPlasticEnabled(!plasticEnabled)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    plasticEnabled
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {plasticEnabled ? (
                    <span className="inline-flex items-center gap-1">
                      <IconCheck className="w-3.5 h-3.5" />
                      <span>Enabled</span>
                    </span>
                  ) : (
                    "Enable Plastic"
                  )}
                </button>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
                Independent plastic shells without glass bottles. Preserved in database history. When disabled, the UI simplifies strictly to glass crates.
              </p>
            </div>
          </div>

          {/* Default Bottles per Crate Input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <label htmlFor="defaultBottles" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                Standard Quantity of Bottles in Crate (Default: 24)
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Global bottle capacity per crate. Products only specify whether their crate is returnable or not; bottle count is governed here.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700">
                <input
                  id="defaultBottles"
                  name="defaultBottles"
                  type="number"
                  min="1"
                  max="99"
                  disabled={isCloud}
                  value={defaultBottles}
                  onChange={(e) => setDefaultBottles(Math.max(1, parseInt(e.target.value, 10) || 24))}
                  className="w-16 text-sm font-bold text-center bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-hidden disabled:opacity-75"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">bottles / crate</span>
              </div>

              {!isCloud && (
                <button
                  type="submit"
                  disabled={isTypesPending}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isTypesPending ? "Saving..." : "Save Settings"}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* ========================================================= */}
      {/* 2. PRODUCT RETURNABLE CRATE MATRIX                        */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Product Returnable Crate Policy
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                {totalReturnable} of {initialProducts.length} Returnable
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Specify if each beverage uses returnable glass crates. Standard bottle capacity ({defaultBottles} bottles/crate) is managed in settings above.
            </p>
          </div>

          {/* Quick Bulk Actions */}
          {!isCloud && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleBulkSetAll(true)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
              >
                Set All to Returnable
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAll(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer"
              >
                Set All to One-Way (PET/Can)
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <IconSearch className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search product name, brand, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="ALL">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {!isCloud && hasUnsavedChanges && (
              <form action={bulkAction}>
                <input
                  type="hidden"
                  name="configs"
                  value={JSON.stringify(productConfigs)}
                />
                <button
                  type="submit"
                  disabled={isBulkPending}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
                >
                  {isBulkPending ? "Saving..." : "Save Crate Policies"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Product Table */}
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-5 py-3">Product Name &amp; Brand</th>
                <th className="px-5 py-3 text-center">Returnable Crate?</th>
                <th className="px-5 py-3">Packaging &amp; Ledger Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-zinc-500">
                    No products match the filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const cfg = productConfigs[p.id] || { hasGlassCrate: true, bottlesPerCrate: defaultBottles };

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500 mt-0.5">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{p.brand}</span>
                          {p.sku && <span>&bull; SKU: {p.sku}</span>}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          disabled={isCloud}
                          onClick={() => handleToggleGlassCrate(p.id)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                            isCloud ? "cursor-default opacity-80" : "cursor-pointer"
                          } ${
                            cfg.hasGlassCrate
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          {cfg.hasGlassCrate ? (
                            <span className="inline-flex items-center gap-1.5">
                              <IconCheck className="w-3.5 h-3.5" />
                              <span>Returnable Crate</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <IconClose className="w-3.5 h-3.5" />
                              <span>One-Way (Non-Returnable)</span>
                            </span>
                          )}
                        </button>
                      </td>

                      <td className="px-5 py-3.5">
                        {cfg.hasGlassCrate ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Returnable glass crate ({defaultBottles} bottles/crate owed by customer)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-zinc-400 font-medium text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            <span>Disposable one-way packaging (no empty crates owed)</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {hasUnsavedChanges && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-4">
            <span className="text-xs text-amber-800 dark:text-amber-200 font-medium">
              You have unsaved changes to product crate policies.
            </span>
            <form action={bulkAction}>
              <input
                type="hidden"
                name="configs"
                value={JSON.stringify(productConfigs)}
              />
              <button
                type="submit"
                disabled={isBulkPending}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isBulkPending ? "Saving..." : "Save Crate Policies"}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Developer Credit */}
      <DeveloperCredit variant="card" />
    </div>
  );
}
