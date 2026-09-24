"use client";

import { useState, useActionState, useTransition } from "react";
import Link from "next/link";
import {
  updateContainerTypesAction,
  updateBulkProductCratesAction,
  type CrateActionState,
} from "./actions";
import type { ContainerSettings } from "@/lib/containers/settings-service";
import { IconPackage, IconCheck, IconSearch, IconAlertTriangle } from "@/components/ui/icons";

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
  const [typesState, typesAction, isTypesPending] = useActionState(
    updateContainerTypesAction,
    null
  );
  const [bulkState, bulkAction, isBulkPending] = useActionState(
    updateBulkProductCratesAction,
    null
  );

  const [glassEnabled, setGlassEnabled] = useState(settings.enabledTypes.glass);
  const [plasticEnabled, setPlasticEnabled] = useState(settings.enabledTypes.plastic);
  const [defaultBottles, setDefaultBottles] = useState(settings.defaultBottlesPerCrate);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");

  // Local state for product configs
  const [productConfigs, setProductConfigs] = useState<Record<string, { hasGlassCrate: boolean; bottlesPerCrate: number }>>(() => {
    const map: Record<string, { hasGlassCrate: boolean; bottlesPerCrate: number }> = {};
    for (const p of initialProducts) {
      map[p.id] = {
        hasGlassCrate: p.hasGlassCrate,
        bottlesPerCrate: p.bottlesPerCrate,
      };
    }
    return map;
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleToggleGlassCrate = (productId: string) => {
    setProductConfigs((prev) => {
      const cur = prev[productId] || { hasGlassCrate: true, bottlesPerCrate: 24 };
      const next = {
        ...prev,
        [productId]: {
          ...cur,
          hasGlassCrate: !cur.hasGlassCrate,
        },
      };
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const handleChangeBottles = (productId: string, count: number) => {
    setProductConfigs((prev) => {
      const cur = prev[productId] || { hasGlassCrate: true, bottlesPerCrate: 24 };
      const next = {
        ...prev,
        [productId]: {
          ...cur,
          bottlesPerCrate: Math.max(1, count),
        },
      };
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const handleBulkSetAll = (hasGlass: boolean) => {
    setProductConfigs((prev) => {
      const next = { ...prev };
      for (const p of filteredProducts) {
        next[p.id] = {
          hasGlassCrate: hasGlass,
          bottlesPerCrate: next[p.id]?.bottlesPerCrate || defaultBottles,
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
            <span className="text-xs text-zinc-500">
              Core Operation: <strong className="text-zinc-700 dark:text-zinc-300">Glass-Only Depot</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            Crate &amp; Returnable Container Settings
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Configure returnable glass crates, bottle counts per crate, and active container types for POS sales and customer ledgers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="px-4 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            ← View Products Catalog
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {(typesState?.success || bulkState?.success) && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold text-xs flex items-center gap-2">
          <span>✓</span>
          <span>{typesState?.message || bulkState?.message}</span>
        </div>
      )}
      {(typesState?.error || bulkState?.error) && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 font-semibold text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{typesState?.error || bulkState?.error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. CONTAINER TYPES CONTROL PANEL                          */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-6">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <IconPackage className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Container Types Active in System</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Control which crate and container categories appear on sales tickets, return vouchers, and customer ledgers.
            </p>
          </div>
        </div>

        <form action={typesAction} className="space-y-6">
          <input type="hidden" name="glassEnabled" value={String(glassEnabled)} />
          <input type="hidden" name="plasticEnabled" value={String(plasticEnabled)} />

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
                    🍾
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Returnable Glass Bottles &amp; Crates
                    </h3>
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
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
                  {glassEnabled ? "✓ Enabled" : "Disabled"}
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
                    📦
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Plastic Crates Only
                    </h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
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
                  {plasticEnabled ? "✓ Enabled" : "Enable Plastic"}
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
                Standard Default Bottles Per Crate
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Applied automatically when adding new beverage products (standard Pepsi/Coke glass crate is 24 bottles).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="defaultBottles"
                name="defaultBottles"
                type="number"
                min="1"
                max="99"
                value={defaultBottles}
                onChange={(e) => setDefaultBottles(Math.max(1, parseInt(e.target.value, 10) || 24))}
                className="w-24 px-3 py-2 text-sm font-bold text-center rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />

              <button
                type="submit"
                disabled={isTypesPending}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isTypesPending ? "Saving..." : "Save Container Settings"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ========================================================= */}
      {/* 2. PRODUCT RETURNABLE CRATE MATRIX                        */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Product Returnable Glass Crate Configuration
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                {totalReturnable} of {initialProducts.length} Returnable
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Set whether each beverage product requires empty glass crates to be returned, and specify how many bottles are in that crate (default: 24).
            </p>
          </div>

          {/* Quick Bulk Actions */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleBulkSetAll(true)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
            >
              Set All Filtered to Glass
            </button>
            <button
              type="button"
              onClick={() => handleBulkSetAll(false)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
            >
              Set All Filtered to Non-Glass
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name, brand, SKU..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
            <button
              type="button"
              onClick={() => setBrandFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                brandFilter === "ALL"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              All Brands
            </button>
            {brands.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrandFilter(b)}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                  brandFilter === b
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Table */}
        <form action={bulkAction} className="space-y-4">
          <input type="hidden" name="configs" value={JSON.stringify(productConfigs)} />

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Product &amp; Brand</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Returnable Glass Crate?</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Bottles Per Crate</th>
                  <th scope="col" className="px-5 py-3.5">POS &amp; Customer Ledger Behavior</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {filteredProducts.map((p) => {
                  const cfg = productConfigs[p.id] || { hasGlassCrate: true, bottlesPerCrate: 24 };

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors ${
                        cfg.hasGlassCrate ? "" : "bg-zinc-50/40 dark:bg-zinc-900/40 opacity-75"
                      }`}
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
                          onClick={() => handleToggleGlassCrate(p.id)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            cfg.hasGlassCrate
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          {cfg.hasGlassCrate ? "✓ Yes (Glass Crate)" : "✕ No (Disposable/PET)"}
                        </button>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            disabled={!cfg.hasGlassCrate}
                            value={cfg.bottlesPerCrate}
                            onChange={(e) => handleChangeBottles(p.id, parseInt(e.target.value, 10) || 24)}
                            className={`w-16 px-2.5 py-1 text-center font-bold rounded-lg border text-xs ${
                              cfg.hasGlassCrate
                                ? "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                : "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/40 text-zinc-400 cursor-not-allowed"
                            }`}
                          />
                          <span className="text-zinc-400 text-[11px]">bottles</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {cfg.hasGlassCrate ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Creates returnable debt ({cfg.bottlesPerCrate} bottles/crate)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-zinc-400 font-medium text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            <span>One-way packaging; no empty crates tracked</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sticky Bottom Save Action Bar */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {hasUnsavedChanges ? (
                <b className="text-amber-600 dark:text-amber-400">⚠️ You have unsaved crate modifications.</b>
              ) : (
                "All crate configurations in sync."
              )}
            </span>

            <button
              type="submit"
              disabled={isBulkPending}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? "bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-500/30 animate-pulse"
                  : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              } disabled:opacity-50`}
            >
              {isBulkPending ? "Saving Configurations..." : "Save Product Crate Configurations"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
