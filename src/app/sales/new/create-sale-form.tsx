"use client";

import { useState, useActionState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SaleType, PaymentMethod, PriceTier } from "@prisma/client";
import { createSaleAction } from "../actions";
import { formatCurrency } from "@/lib/formatters";
import { CrateStepper } from "@/components/ui/crate-stepper";
import { CompletionCard } from "@/components/ui/completion-card";
import { KeyboardShortcutsModal } from "@/components/ui/keyboard-shortcuts-modal";
import {
  IconPrinter,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconUsers,
  IconPackage,
  IconSearch,
  IconCheck,
  IconAlertTriangle,
  IconClose,
  IconKeyboard,
} from "@/components/ui/icons";
import type { StaffProductListItem } from "@/lib/products/service";
import type { CustomerSummary } from "@/lib/customers/service";
import type { ContainerSettings, ProductCrateConfig } from "@/lib/containers/settings-service";

type ProductOption = StaffProductListItem & { crateConfig?: ProductCrateConfig };
type CustomerOption = CustomerSummary;

type FormLineItem = {
  key: string;
  productId: string;
  quantity: number;
  unitPrice: number;
};

// Brand colors for tactile visual identification on POS grid
const BRAND_STYLES: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  pepsi: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", accent: "bg-blue-600" },
  "7up": { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800", accent: "bg-emerald-600" },
  mirinda: { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800", accent: "bg-orange-500" },
  sting: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800", accent: "bg-red-600" },
  "mountain dew": { bg: "bg-lime-50 dark:bg-lime-950/40", text: "text-lime-700 dark:text-lime-300", border: "border-lime-200 dark:border-lime-800", accent: "bg-lime-600" },
  aquafina: { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800", accent: "bg-cyan-600" },
};

function getBrandStyle(brand: string) {
  const key = brand.toLowerCase().trim();
  return (
    BRAND_STYLES[key] || {
      bg: "bg-zinc-100 dark:bg-zinc-800",
      text: "text-zinc-700 dark:text-zinc-300",
      border: "border-zinc-200 dark:border-zinc-700",
      accent: "bg-zinc-600",
    }
  );
}

export function CreateSaleForm({
  products,
  customers,
  initialCustomerId,
  containerSettings,
}: {
  products: ProductOption[];
  customers: CustomerOption[];
  initialCustomerId?: string;
  containerSettings?: ContainerSettings;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createSaleAction, null);
  const [clientError, setClientError] = useState<string | null>(null);

  // Form & Input Refs for fast keyboard navigation
  const formRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const paidAmountInputRef = useRef<HTMLInputElement>(null);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // POS State
  const [customerId, setCustomerId] = useState<string>(initialCustomerId || "");
  const [saleType, setSaleType] = useState<SaleType>(SaleType.RETAIL);
  const [discount, setDiscount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paidAmount, setPaidAmount] = useState<string>("0");
  const [plasticCrates, setPlasticCrates] = useState<number>(0);
  const [glassBottles, setGlassBottles] = useState<number>(0);

  // POS Catalog filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [mobileTab, setMobileTab] = useState<"catalog" | "ticket">("catalog");

  // Helper to get unit price for a product based on current saleType
  const getProductDefaultPrice = (product: ProductOption, type: SaleType): number => {
    const tierMap: Record<SaleType, PriceTier> = {
      [SaleType.RETAIL]: PriceTier.RETAIL,
      [SaleType.WHOLESALE]: PriceTier.WHOLESALE,
      [SaleType.KEY_ACCOUNT]: PriceTier.KEY_ACCOUNT,
    };
    const targetTier = tierMap[type];
    const priceObj = product.activePrices.find((p) => p.tier === targetTier);
    if (priceObj) {
      return parseFloat(priceObj.amount) || 0;
    }
    return parseFloat(product.activePrices[0]?.amount || "0");
  };

  // Cart / Line items
  const [items, setItems] = useState<FormLineItem[]>(() => {
    return [];
  });

  // Unique brands list for filter tabs
  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.brand) set.add(p.brand);
    }
    return Array.from(set).sort();
  }, [products]);

  // Filtered products on POS grid
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchBrand = selectedBrand === "ALL" || p.brand.toLowerCase() === selectedBrand.toLowerCase();
      const matchQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchBrand && matchQuery;
    });
  }, [products, selectedBrand, searchQuery]);

  // When customer changes, automatically adapt saleType to customer's priceTier
  const handleCustomerChange = (newCustomerId: string) => {
    setCustomerId(newCustomerId);
    if (newCustomerId) {
      const cust = customers.find((c) => c.id === newCustomerId);
      if (cust) {
        let newType: SaleType = SaleType.RETAIL;
        if (cust.priceTier === PriceTier.WHOLESALE) newType = SaleType.WHOLESALE;
        else if (cust.priceTier === PriceTier.KEY_ACCOUNT) newType = SaleType.KEY_ACCOUNT;

        setSaleType(newType);
        setItems((prev) =>
          prev.map((item) => {
            if (!item.productId) return item;
            const p = products.find((prod) => prod.id === item.productId);
            return p ? { ...item, unitPrice: getProductDefaultPrice(p, newType) } : item;
          })
        );
      }
    }
  };

  // When sale type changes, update unit prices
  const handleSaleTypeChange = (newType: SaleType) => {
    setSaleType(newType);
    setItems((prev) =>
      prev.map((item) => {
        if (!item.productId) return item;
        const p = products.find((prod) => prod.id === item.productId);
        return p ? { ...item, unitPrice: getProductDefaultPrice(p, newType) } : item;
      })
    );
  };

  // POS Add item to ticket (click product tile)
  const handleAddProductToTicket = (product: ProductOption, delta = 1) => {
    setClientError(null);
    const existingIndex = items.findIndex((i) => i.productId === product.id);

    if (existingIndex >= 0) {
      const currentQty = items[existingIndex].quantity;
      const newQty = currentQty + delta;
      if (newQty <= 0) {
        setItems((prev) => prev.filter((_, idx) => idx !== existingIndex));
        return;
      }
      if (newQty > product.currentStock) {
        setClientError(`Only ${product.currentStock} crates of "${product.name}" are in stock.`);
        return;
      }
      setItems((prev) => {
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], quantity: newQty };
        return copy;
      });
    } else {
      if (delta <= 0) return;
      if (delta > product.currentStock) {
        setClientError(`Only ${product.currentStock} crates of "${product.name}" are in stock.`);
        return;
      }
      const unitPrice = getProductDefaultPrice(product, saleType);
      setItems((prev) => [
        ...prev,
        {
          key: `pos-${product.id}-${Date.now()}`,
          productId: product.id,
          quantity: delta,
          unitPrice,
        },
      ]);
    }
  };

  const handleUpdateItemQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const item = items[index];
    const prod = products.find((p) => p.id === item.productId);
    if (prod && newQty > prod.currentStock) {
      setClientError(`Only ${prod.currentStock} crates of "${prod.name}" are in stock.`);
      return;
    }
    setClientError(null);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: newQty };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setClientError(null);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setItems([]);
    setClientError(null);
    setDiscount("0");
    setPaidAmount("0");
    setPlasticCrates(0);
    setGlassBottles(0);
  };

  // Calculations
  const subtotal = items.reduce((acc, item) => {
    if (!item.productId) return acc;
    return acc + item.quantity * item.unitPrice;
  }, 0);

  const totalCratesSold = items.reduce((acc, item) => {
    if (!item.productId) return acc;
    return acc + (parseInt(item.quantity.toString(), 10) || 0);
  }, 0);

  // Returnable Glass Crates & Bottles calculation: Only items with returnable glass packaging count
  const returnableSummary = useMemo(() => {
    let returnableCrates = 0;
    let expectedBottles = 0;
    for (const item of items) {
      if (!item.productId) continue;
      const prod = products.find((p) => p.id === item.productId);
      const cfg = prod?.crateConfig || {
        hasGlassCrate: true,
        bottlesPerCrate: containerSettings?.defaultBottlesPerCrate || 24,
      };
      if (cfg.hasGlassCrate) {
        const qty = parseInt(item.quantity.toString(), 10) || 0;
        returnableCrates += qty;
        expectedBottles += qty * (cfg.bottlesPerCrate || 24);
      }
    }
    return { returnableCrates, expectedBottles };
  }, [items, products, containerSettings]);

  const handleAutoFillContainers = () => {
    const plasticActive = containerSettings?.enabledTypes?.plastic ?? false;
    setPlasticCrates(plasticActive ? returnableSummary.returnableCrates : 0);
    setGlassBottles(returnableSummary.expectedBottles);
  };

  const discountNum = parseFloat(discount) || 0;
  const totalAmount = Math.max(0, Math.round((subtotal - discountNum) * 100) / 100);
  const paidAmountNum = parseFloat(paidAmount) || 0;
  const creditAmount = Math.max(0, Math.round((totalAmount - paidAmountNum) * 100) / 100);
  const changeDue = Math.max(0, Math.round((paidAmountNum - totalAmount) * 100) / 100);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Quick paid in full button
  const handlePayInFull = () => {
    setPaidAmount(totalAmount.toFixed(2));
  };

  const handleAddQuickCash = (amountToAdd: number) => {
    const current = parseFloat(paidAmount) || 0;
    setPaidAmount((current + amountToAdd).toFixed(2));
  };

  // Contextual completion receipt state
  const [completedSale, setCompletedSale] = useState<{
    saleId: string;
    invoiceNumber: string;
    customerName: string;
    totalAmount: number;
    paidAmount: number;
    creditAmount: number;
    itemCount: number;
    cratesSold: number;
  } | null>(null);

  useEffect(() => {
    if (state?.success && state.saleId && !completedSale) {
      setCompletedSale({
        saleId: state.saleId,
        invoiceNumber: state.invoiceNumber || state.saleId.slice(0, 8),
        customerName: selectedCustomer ? selectedCustomer.name : "Walk-in Customer",
        totalAmount,
        paidAmount: paidAmountNum,
        creditAmount,
        itemCount: items.filter((i) => Boolean(i.productId)).length,
        cratesSold: totalCratesSold,
      });
    }
  }, [
    state?.success,
    state?.saleId,
    state?.invoiceNumber,
    completedSale,
    selectedCustomer,
    totalAmount,
    paidAmountNum,
    creditAmount,
    items,
    totalCratesSold,
  ]);

  // Keyboard shortcut listener for fast counter operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      // F2: Focus Product Search
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // '/' when not in input focuses search
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F4: Focus Customer Select
      if (e.key === "F4") {
        e.preventDefault();
        customerSelectRef.current?.focus();
        return;
      }

      // F7: Auto-Match Returnable Empties
      if (e.key === "F7") {
        e.preventDefault();
        const plasticActive = containerSettings?.enabledTypes?.plastic ?? false;
        setPlasticCrates(plasticActive ? returnableSummary.returnableCrates : 0);
        setGlassBottles(returnableSummary.expectedBottles);
        return;
      }

      // F8: Exact Tender (Pay in Full)
      if (e.key === "F8") {
        e.preventDefault();
        setPaidAmount(totalAmount.toFixed(2));
        return;
      }

      // F9: Focus Amount Received (Tender input)
      if (e.key === "F9") {
        e.preventDefault();
        paidAmountInputRef.current?.focus();
        paidAmountInputRef.current?.select();
        return;
      }

      // Ctrl + Enter or Cmd + Enter: Finalize & Complete Invoice
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (items.length > 0 && !isPending) {
          formRef.current?.requestSubmit();
        }
        return;
      }

      // Alt + C: Clear cart
      if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        if (items.length > 0) {
          handleClearCart();
        }
        return;
      }

      // '?' when not typing in an input: Open shortcuts modal
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Escape: close modal or clear search
      if (e.key === "Escape") {
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
          return;
        }
        if (searchQuery) {
          setSearchQuery("");
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    items.length,
    isPending,
    totalAmount,
    returnableSummary,
    containerSettings,
    shortcutsModalOpen,
    searchQuery,
  ]);

  const handleResetForNewSale = () => {
    setCompletedSale(null);
    setCustomerId("");
    setSaleType(SaleType.RETAIL);
    setDiscount("0");
    setPaymentMethod(PaymentMethod.CASH);
    setPaidAmount("0");
    setPlasticCrates(0);
    setGlassBottles(0);
    setClientError(null);
    setItems([]);
    router.refresh();
  };

  // When sale is completed, pressing Enter or Space rings up the next sale
  useEffect(() => {
    if (!completedSale) return;
    const handleNextSaleShortcut = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleResetForNewSale();
      }
    };
    window.addEventListener("keydown", handleNextSaleShortcut);
    return () => window.removeEventListener("keydown", handleNextSaleShortcut);
  }, [completedSale]);

  // Submission validation
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const validItems = items.filter((i) => Boolean(i.productId));
    if (validItems.length === 0) {
      e.preventDefault();
      setClientError("Ticket is empty! Tap at least one product on the left to add crates.");
      return;
    }

    for (const item of validItems) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && item.quantity > prod.currentStock) {
        e.preventDefault();
        setClientError(
          `Only ${prod.currentStock} crates of "${prod.name}" are available in the warehouse (you requested ${item.quantity}).`
        );
        return;
      }
    }

    if (creditAmount > 0 && !customerId) {
      e.preventDefault();
      setClientError("Anonymous walk-in sales cannot be on credit. Collect full cash or select a registered Customer.");
      return;
    }

    if (creditAmount > 0 && selectedCustomer && !selectedCustomer.creditAllowed) {
      e.preventDefault();
      setClientError(`Customer "${selectedCustomer.name}" is not approved for credit purchases.`);
      return;
    }
    setClientError(null);
  };

  if (completedSale) {
    return (
      <CompletionCard
        title="Sale Completed Successfully"
        subtitle="Invoice and warehouse dispatch have been recorded in the system."
        referenceLabel="Invoice #"
        referenceNumber={completedSale.invoiceNumber}
        details={[
          { label: "Customer", value: completedSale.customerName },
          { label: "Crates Dispatched", value: `${completedSale.cratesSold} crates (${completedSale.itemCount} items)` },
          { label: "Total Amount", value: formatCurrency(completedSale.totalAmount), highlight: true },
          { label: "Amount Paid", value: formatCurrency(completedSale.paidAmount), color: "success" },
          {
            label: "Remaining Credit Due",
            value: completedSale.creditAmount > 0 ? formatCurrency(completedSale.creditAmount) : "Paid in Full (Rs. 0)",
            color: completedSale.creditAmount > 0 ? "warning" : "default",
            highlight: completedSale.creditAmount > 0,
          },
        ]}
        primaryAction={{
          label: "+ Ring Up Next Sale",
          onClick: handleResetForNewSale,
          icon: <IconPlus className="w-5 h-5" />,
        }}
        secondaryActions={[
          {
            label: "Print 80mm Receipt",
            href: `/sales/${completedSale.saleId}`,
            icon: <IconPrinter className="w-4 h-4" />,
          },
          {
            label: "View Full Invoice",
            href: `/sales/${completedSale.saleId}`,
          },
          {
            label: "Sales History",
            href: "/sales",
          },
        ]}
      />
    );
  }

  const payloadItems = items
    .filter((i) => Boolean(i.productId))
    .map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="w-full">
      <input type="hidden" name="items" value={JSON.stringify(payloadItems)} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="saleType" value={saleType} />
      <input type="hidden" name="discount" value={discount} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <input type="hidden" name="paidAmount" value={paidAmount} />
      <input type="hidden" name="plasticCrates" value={plasticCrates.toString()} />
      <input type="hidden" name="glassBottles" value={glassBottles.toString()} />

      {/* Accessible Inline Error Banner */}
      {(clientError || state?.error) && (
        <div
          role="alert"
          className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-medium flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">Notice:</span>
            <span>{clientError || state?.error}</span>
          </div>
          <button
            type="button"
            onClick={() => setClientError(null)}
            className="text-xs font-semibold px-2.5 py-1 rounded bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 text-red-800 dark:text-red-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center gap-2 mb-4 p-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-xl">
        <button
          type="button"
          onClick={() => setMobileTab("catalog")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mobileTab === "catalog"
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          📦 Catalog ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("ticket")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === "ticket"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          <span>🧾 Ticket</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[11px] font-black tabular-nums">
            {totalCratesSold} crates
          </span>
          <span className="font-bold">{formatCurrency(totalAmount)}</span>
        </button>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Fast Product Picker / Catalog Grid          */}
        {/* ========================================================= */}
        <div className={`lg:col-span-7 xl:col-span-7 2xl:col-span-8 space-y-4 ${mobileTab === "ticket" ? "hidden lg:block" : "block"}`}>
          {/* Search & Brand Filter Toolbar */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Search Bar with Barcode Scanner & Enter Key Auto-add */}
              <div className="relative flex-1">
                <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const q = searchQuery.trim().toLowerCase();
                      if (!q) return;

                      // 1. Exact SKU match (barcode scanners transmit SKU + Enter)
                      const exactSku = products.find((p) => p.sku && p.sku.toLowerCase() === q);
                      if (exactSku && exactSku.currentStock > 0) {
                        handleAddProductToTicket(exactSku, 1);
                        setSearchQuery("");
                        return;
                      }

                      // 2. Exact Name match
                      const exactName = products.find((p) => p.name.toLowerCase() === q);
                      if (exactName && exactName.currentStock > 0) {
                        handleAddProductToTicket(exactName, 1);
                        setSearchQuery("");
                        return;
                      }

                      // 3. If filtered list has exactly 1 result, auto-add it
                      if (filteredProducts.length === 1 && filteredProducts[0].currentStock > 0) {
                        handleAddProductToTicket(filteredProducts[0], 1);
                        setSearchQuery("");
                        return;
                      }
                    }
                  }}
                  placeholder="Fast search product or scan barcode..."
                  className="w-full pl-10 pr-16 py-2.5 text-sm font-medium rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-colors"
                />

                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs p-1"
                    >
                      ✕
                    </button>
                  ) : (
                    <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                      F2
                    </kbd>
                  )}
                </div>
              </div>

              {/* Items Counter Badge & Shortcuts Trigger */}
              <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-zinc-500">
                <span className="hidden sm:inline">
                  Showing <strong className="text-zinc-800 dark:text-zinc-200">{filteredProducts.length}</strong> products
                </span>
                <button
                  type="button"
                  onClick={() => setShortcutsModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 font-semibold shadow-2xs transition-colors cursor-pointer"
                  title="Keyboard Shortcuts Cheat Sheet (?)"
                >
                  <IconKeyboard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Keys</span>
                  <kbd className="px-1 text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-400">?</kbd>
                </button>
              </div>
            </div>

            {/* Brand Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setSelectedBrand("ALL")}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                  selectedBrand === "ALL"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750"
                }`}
              >
                All Brands
              </button>
              {brands.map((b) => {
                const isSelected = selectedBrand.toLowerCase() === b.toLowerCase();
                const style = getBrandStyle(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBrand(b)}
                    className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? `${style.accent} text-white shadow-xs`
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-750"
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Touch Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
            {filteredProducts.map((prod) => {
              const currentPrice = getProductDefaultPrice(prod, saleType);
              const inStock = prod.currentStock > 0;
              const isLowStock = prod.currentStock <= 10 && inStock;
              const itemInCart = items.find((i) => i.productId === prod.id);
              const qtyInCart = itemInCart?.quantity || 0;
              const brandStyle = getBrandStyle(prod.brand);

              return (
                <div
                  key={prod.id}
                  onClick={() => inStock && handleAddProductToTicket(prod, 1)}
                  className={`relative p-4 rounded-2xl border transition-all text-left flex flex-col justify-between select-none group ${
                    inStock ? "cursor-pointer active:scale-[0.985]" : "opacity-50 cursor-not-allowed"
                  } ${
                    qtyInCart > 0
                      ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-500 dark:border-blue-500 shadow-xs ring-2 ring-blue-500/20"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs hover:shadow-xs"
                  }`}
                >
                  {/* Top Bar on Tile: Brand badge & Cart quantity indicator */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${brandStyle.bg} ${brandStyle.text} ${brandStyle.border}`}
                    >
                      {prod.brand}
                    </span>

                    {qtyInCart > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                        <IconCheck className="w-3 h-3 stroke-[3]" />
                        {qtyInCart} in cart
                      </span>
                    ) : (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          inStock
                            ? isLowStock
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                        }`}
                      >
                        {inStock ? `${prod.currentStock} left` : "Out of stock"}
                      </span>
                    )}
                  </div>

                  {/* Packaging Type Pill */}
                  <div className="mb-1">
                    {prod.crateConfig && !prod.crateConfig.hasGlassCrate ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        📦 One-way (PET/Can)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/40">
                        🍾 {prod.crateConfig?.bottlesPerCrate || 24}b Glass
                      </span>
                    )}
                  </div>

                  {/* Product Title */}
                  <div className="my-1.5">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {prod.name}
                    </h3>
                    {prod.sku && <p className="text-[11px] text-zinc-400 mt-0.5">{prod.sku}</p>}
                  </div>

                  {/* Bottom: Price and Quick Add Stepper */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Unit Price</span>
                      <span className="text-base font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {formatCurrency(currentPrice)}
                      </span>
                    </div>

                    {/* Quick increment buttons if already in cart */}
                    {inStock && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1"
                      >
                        {qtyInCart > 0 ? (
                          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700">
                            <button
                              type="button"
                              onClick={() => handleAddProductToTicket(prod, -1)}
                              className="w-6 h-6 rounded flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95"
                              title="Decrease 1"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-black tabular-nums">
                              {qtyInCart}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddProductToTicket(prod, 1)}
                              className="w-6 h-6 rounded flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-95"
                              title="Add 1"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddProductToTicket(prod, 1)}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white transition-colors"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8">
                <IconPackage className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No products match your filter</h4>
                <p className="text-xs text-zinc-500 mt-1">Try searching for a different keyword or brand.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedBrand("ALL");
                  }}
                  className="mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: POS Register Tape / Order Ticket (Sticky)  */}
        {/* ========================================================= */}
        <div
          className={`lg:col-span-5 xl:col-span-5 2xl:col-span-4 sticky top-4 space-y-4 ${
            mobileTab === "catalog" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-md p-5 space-y-4">
            {/* Header: Terminal Title and Clear Cart */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                  POS
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                    Order Ticket
                  </h2>
                  <span className="text-[11px] text-zinc-400">
                    {items.length} item{items.length !== 1 ? "s" : ""} • {totalCratesSold} crate{totalCratesSold !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs font-semibold text-zinc-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Customer Selector & Pricing Tier */}
            <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-750">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <span>Customer</span>
                  <kbd className="px-1 py-0.2 text-[9px] font-mono font-bold bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-400">
                    F4
                  </kbd>
                </label>
                {customerId && (
                  <button
                    type="button"
                    onClick={() => handleCustomerChange("")}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Switch to Walk-in
                  </button>
                )}
              </div>

              <select
                ref={customerSelectRef}
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Walk-in Customer (Cash Counter)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.priceTier}) {c.phone ? `— ${c.phone}` : ""}
                  </option>
                ))}
              </select>

              {/* Customer Account Summary if registered customer */}
              {selectedCustomer && (
                <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Owes Us</span>
                    <span className="font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                      {formatCurrency(selectedCustomer.outstandingBalance)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Customer Tier</span>
                    <span className="font-extrabold text-zinc-800 dark:text-zinc-200 uppercase">
                      {selectedCustomer.priceTier}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Credit Allowed</span>
                    <span className={`font-extrabold ${selectedCustomer.creditAllowed ? "text-emerald-600" : "text-red-500"}`}>
                      {selectedCustomer.creditAllowed ? "Yes" : "Cash Only"}
                    </span>
                  </div>
                </div>
              )}

              {/* Price Tier Override Pills */}
              <div className="pt-1 flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Tier:</span>
                {(["RETAIL", "WHOLESALE", "KEY_ACCOUNT"] as SaleType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSaleTypeChange(t)}
                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md cursor-pointer transition-colors ${
                      saleType === t
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {t.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Ticket Cart Line Items List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <IconReceipt className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Cart is empty</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Click products on the left catalog to add them to this sale.
                  </p>
                </div>
              ) : (
                items.map((item, idx) => {
                  const prod = products.find((p) => p.id === item.productId);
                  if (!prod) return null;
                  const lineTotal = item.quantity * item.unitPrice;

                  return (
                    <div
                      key={item.key}
                      className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {formatCurrency(item.unitPrice)} / crate
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(idx, item.quantity - 1)}
                          className="w-6 h-6 rounded flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={prod.currentStock}
                          value={item.quantity}
                          onChange={(e) => handleUpdateItemQuantity(idx, parseInt(e.target.value, 10) || 1)}
                          className="w-9 text-center text-xs font-black tabular-nums bg-transparent focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(idx, item.quantity + 1)}
                          className="w-6 h-6 rounded flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Subtotal */}
                      <div className="text-right shrink-0 w-20">
                        <div className="font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-zinc-400 hover:text-red-500 p-1"
                        title="Remove item"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Container Returns & Discounts Bar */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 block">
                    {containerSettings?.enabledTypes?.plastic ? "Empty Crates Received:" : "Empty Returnable Crates:"}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {returnableSummary.returnableCrates > 0
                      ? `Returnable sold: ${returnableSummary.returnableCrates} crates (${returnableSummary.expectedBottles} bottles)`
                      : "No returnable crates (PET/Can)"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={
                      glassBottles > 0
                        ? Math.round(glassBottles / (containerSettings?.defaultBottlesPerCrate || 24))
                        : (plasticCrates || "")
                    }
                    onChange={(e) => {
                      const count = Math.max(0, parseInt(e.target.value, 10) || 0);
                      const bpc = containerSettings?.defaultBottlesPerCrate || 24;
                      const plasticActive = containerSettings?.enabledTypes?.plastic ?? false;
                      setGlassBottles(count * bpc);
                      setPlasticCrates(plasticActive ? count : 0);
                    }}
                    className="w-16 px-2 py-1 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={handleAutoFillContainers}
                    disabled={returnableSummary.returnableCrates === 0}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    title="Match with returnable crates sold (F7)"
                  >
                    <span>Match ({returnableSummary.returnableCrates})</span>
                    <kbd className="text-[9px] font-mono opacity-60">F7</kbd>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-600 dark:text-zinc-400">Special Discount (Rs.):</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 px-2 py-1 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-right tabular-nums"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Totals & Grand Total Banner */}
            <div className="p-4 rounded-xl bg-zinc-900 dark:bg-zinc-950 text-white space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Subtotal ({totalCratesSold} crates):</span>
                <span className="tabular-nums font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              {discountNum > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-400">
                  <span>Discount:</span>
                  <span className="tabular-nums font-semibold">- {formatCurrency(discountNum)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                    Total Payable
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Payment Method</span>
                  <span className="text-xs font-extrabold text-blue-400 uppercase">
                    {paymentMethod.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector Pills */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                Payment Channel
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { method: PaymentMethod.CASH, label: "Cash" },
                  { method: PaymentMethod.EASYPAISA, label: "EasyPaisa" },
                  { method: PaymentMethod.JAZZCASH, label: "JazzCash" },
                  { method: PaymentMethod.QR, label: "QR / Bank" },
                ].map((pm) => (
                  <button
                    key={pm.method}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(pm.method);
                      if (pm.method === PaymentMethod.CASH) {
                        setPaidAmount(totalAmount.toFixed(2));
                      }
                    }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      paymentMethod === pm.method
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Tender Row & Shortcuts */}
            <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-750">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <span>Amount Received (Rs.)</span>
                  <kbd className="px-1 text-[9px] font-mono font-bold bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-400">
                    F9
                  </kbd>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaidAmount("0")}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    Rs. 0 (Credit)
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <button
                    type="button"
                    onClick={handlePayInFull}
                    className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                    title="Exact Tender / Pay in Full (F8)"
                  >
                    <span>Exact (Pay in Full)</span>
                    <kbd className="px-1 text-[9px] font-mono bg-blue-100 dark:bg-blue-950/80 rounded">F8</kbd>
                  </button>
                </div>
              </div>

              <input
                ref={paidAmountInputRef}
                type="number"
                min="0"
                step="any"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full px-3 py-2 text-base font-black rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 tabular-nums focus:ring-2 focus:ring-blue-500"
              />

              {/* Quick Cash Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                {[500, 1000, 5000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleAddQuickCash(val)}
                    className="flex-1 py-1 text-[11px] font-bold rounded-md bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 active:scale-95"
                  >
                    +{val}
                  </button>
                ))}
              </div>

              {/* Change Due or Remaining Credit Indicator */}
              {paidAmountNum > totalAmount && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Change Due to Customer:</span>
                  <span className="text-sm font-black tabular-nums">{formatCurrency(changeDue)}</span>
                </div>
              )}

              {creditAmount > 0 && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                  <span>Credit Balance (Unpaid):</span>
                  <span className="text-sm font-black tabular-nums">{formatCurrency(creditAmount)}</span>
                </div>
              )}
            </div>

            {/* Main Action Submit Button */}
            <button
              type="submit"
              disabled={isPending || items.length === 0}
              className="w-full py-4 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.985] disabled:active:scale-100 disabled:opacity-50 text-white font-extrabold text-base shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              title="Complete Sale Invoice (Ctrl + Enter)"
            >
              {isPending ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Processing Invoice...</span>
                </>
              ) : (
                <>
                  <IconReceipt className="w-5 h-5 stroke-[2.5]" />
                  <span>
                    COMPLETE SALE — {formatCurrency(totalAmount)}
                  </span>
                  <kbd className="text-xs font-mono font-bold opacity-80 bg-white/20 px-2 py-0.5 rounded ml-2 hidden sm:inline-block">
                    Ctrl+↵
                  </kbd>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cashier Quick-Keys Helper Bar */}
      <div className="hidden lg:flex items-center justify-between px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-600 dark:text-zinc-400 shadow-2xs mt-4">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <IconKeyboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Hotkeys:</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[11px]">F2</kbd>
            <span>Search</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[11px]">Enter</kbd>
            <span>Scan Barcode</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[11px]">F4</kbd>
            <span>Customer</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[11px]">F7</kbd>
            <span>Match Empties</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[11px]">F8</kbd>
            <span>Pay in Full</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[11px]">F9</kbd>
            <span>Tender</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[11px]">Ctrl+↵</kbd>
            <span>Complete</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShortcutsModalOpen(true)}
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0 ml-3"
        >
          All Shortcuts [?]
        </button>
      </div>

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        isPosContext={true}
      />
    </form>
  );
}
