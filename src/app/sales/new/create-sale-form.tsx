"use client";

import { useState, useActionState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { SaleType, PaymentMethod, PriceTier } from "@prisma/client";
import { createSaleAction } from "../actions";
import { formatCurrency } from "@/lib/formatters";
import { KeyboardShortcutsModal } from "@/components/ui/keyboard-shortcuts-modal";
import {
  IconPlus,
  IconReceipt,
  IconTrash,
  IconPackage,
  IconSearch,
  IconCheck,
  IconClose,
  IconKeyboard,
  IconBottle,
  IconAlertTriangle,
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

// Search results are square tiles, so more of them fit than list rows did.
const TILE_RESULT_CAP = 10;

// Brand colors for visual identification
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
  const browserSearchRef = useRef<HTMLInputElement>(null);
  const browserPanelRef = useRef<HTMLDivElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const paidAmountInputRef = useRef<HTMLInputElement>(null);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Invoice confirmation modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);


  // Filter active sale types based on settings
  const enabledRates = containerSettings?.enabledRates || { retail: true, wholesale: true, key: true };
  const allowedSaleTypes = useMemo<SaleType[]>(() => {
    const list: SaleType[] = [];
    if (enabledRates.retail) list.push(SaleType.RETAIL);
    if (enabledRates.wholesale) list.push(SaleType.WHOLESALE);
    if (enabledRates.key) list.push(SaleType.KEY_ACCOUNT);
    return list.length > 0 ? list : [SaleType.RETAIL];
  }, [enabledRates]);

  // POS State
  const [customerId, setCustomerId] = useState<string>(initialCustomerId || "");
  const [saleType, setSaleType] = useState<SaleType>(allowedSaleTypes[0]);
  const [discount, setDiscount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paidAmount, setPaidAmount] = useState<string>("0");
  const [plasticCrates, setPlasticCrates] = useState<number>(0);
  const [glassBottles, setGlassBottles] = useState<number>(0);

  // POS Catalog filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  // The full catalogue is not rendered on the page. It opens on demand, so a
  // 120-product list never pushes the ticket below the fold.
  const [browserOpen, setBrowserOpen] = useState<boolean>(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");

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
  const [items, setItems] = useState<FormLineItem[]>([]);

  // Unique brands list for filter tabs
  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.brand) set.add(p.brand);
    }
    return Array.from(set).sort();
  }, [products]);

  // Filtered products on catalog list
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
        let newType: SaleType = allowedSaleTypes[0];
        if (cust.priceTier === PriceTier.WHOLESALE && enabledRates.wholesale) newType = SaleType.WHOLESALE;
        else if (cust.priceTier === PriceTier.KEY_ACCOUNT && enabledRates.key) newType = SaleType.KEY_ACCOUNT;
        else if (cust.priceTier === PriceTier.RETAIL && enabledRates.retail) newType = SaleType.RETAIL;

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

  // POS Add item to ticket (click product row)
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

  // Update unit price directly (for modal price edits)
  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], unitPrice: Math.max(0, newPrice) };
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

  // Returnable Glass Crates & Bottles calculation
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

  // Post-submission state
  const [lastHandledSaleId, setLastHandledSaleId] = useState<string | null>(null);

  const handleResetForNewSale = () => {
    setCustomerId("");
    setSaleType(allowedSaleTypes[0] || SaleType.RETAIL);
    setDiscount("0");
    setPaymentMethod(PaymentMethod.CASH);
    setPaidAmount("0");
    setPlasticCrates(0);
    setGlassBottles(0);
    setClientError(null);
    setItems([]);
    setShowInvoiceModal(false);
    router.refresh();
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // After successful submission → redirect to receipt page for print
  useEffect(() => {
    if (state?.success && state.saleId && state.saleId !== lastHandledSaleId) {
      setLastHandledSaleId(state.saleId);
      // Clear the working ticket so a stale basket is never left behind.
      handleResetForNewSale();
      // Navigate to receipt page with ?print=1 to auto-trigger print dialog.
      // The receipt page has a "New Sale" button to return here.
      setShowInvoiceModal(false);
      router.push(`/sales/${state.saleId}?print=1`);
    }
  }, [
    state?.success,
    state?.saleId,
    lastHandledSaleId,
  ]);


  // The catalogue is a real modal: lock the page behind it, keep focus inside it,
  // and hand focus to its search box on open.
  useEffect(() => {
    if (!browserOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    browserSearchRef.current?.focus();

    const panel = browserPanelRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [browserOpen]);

  // Keyboard shortcut listener
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

      // F3: Open the product browser pop-up
      if (e.key === "F3") {
        e.preventDefault();
        setBrowserOpen(true);
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

      // Enter while the invoice review is open: record the sale.
      // The modal holds no inputs, so a bare Enter is unambiguous here.
      if (
        e.key === "Enter" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        showInvoiceModal &&
        target?.tagName !== "BUTTON" &&
        !isPending
      ) {
        e.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }

      // Ctrl + Enter or Cmd + Enter: Open invoice modal / submit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (items.length > 0 && !isPending) {
          if (showInvoiceModal) {
            formRef.current?.requestSubmit();
          } else {
            handleOpenInvoiceModal();
          }
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

      // Escape: close modals or clear search
      if (e.key === "Escape") {
        if (browserOpen) {
          setBrowserOpen(false);
          return;
        }
        if (showInvoiceModal) {
          setShowInvoiceModal(false);
          return;
        }
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
    showInvoiceModal,
    browserOpen,
  ]);

  // Submission validation before opening modal
  const handleOpenInvoiceModal = () => {
    const validItems = items.filter((i) => Boolean(i.productId));
    if (validItems.length === 0) {
      setClientError("Ticket is empty! Add at least one product to proceed.");
      return;
    }

    for (const item of validItems) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && item.quantity > prod.currentStock) {
        setClientError(
          `Only ${prod.currentStock} crates of "${prod.name}" available (requested ${item.quantity}).`
        );
        return;
      }
    }

    if (creditAmount > 0 && !customerId) {
      setClientError("Anonymous walk-in sales cannot be on credit. Collect full cash or select a Customer.");
      return;
    }

    if (creditAmount > 0 && selectedCustomer && !selectedCustomer.creditAllowed) {
      setClientError(`Customer "${selectedCustomer.name}" is not approved for credit purchases.`);
      return;
    }

    setClientError(null);
    setShowInvoiceModal(true);
  };

  // Form submit handler (called from modal confirm button)
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const validItems = items.filter((i) => Boolean(i.productId));
    if (validItems.length === 0) {
      e.preventDefault();
      setClientError("Ticket is empty.");
      return;
    }
    setClientError(null);
  };

  const payloadItems = items
    .filter((i) => Boolean(i.productId))
    .map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));

  return (
    <>


      {/* ================================================================ */}
      {/* Invoice Confirmation Modal                                        */}
      {/* ================================================================ */}
      {showInvoiceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60"
          role="dialog"
          aria-modal="true"
          aria-label="Invoice confirmation"
        >
          <div className="bg-surface text-ink rounded-lg border-2 border-rule-strong w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-rule-strong shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded bg-navy text-white flex items-center justify-center">
                  <IconReceipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-ink">Confirm Invoice</h2>
                  <p className="text-[0.9375rem] text-ink-2">Check the prices below, then record the sale.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="btn btn-sm !min-h-11 !px-2"
                aria-label="Close the invoice confirmation and go back to editing"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Customer & Sale Type row */}
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-zinc-400 block text-xs uppercase font-bold tracking-wider">Customer</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedCustomer ? selectedCustomer.name : "Walk-in Customer"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-400 block text-xs uppercase font-bold tracking-wider">Price Tier</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 uppercase">{saleType.replace("_", " ")}</span>
                </div>
              </div>

              {/* Line Items — editable prices */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 gap-2 text-[0.875rem] font-bold uppercase tracking-wider text-ink-2 px-1 pb-1 border-b-2 border-rule-strong">
                  <span className="col-span-5">Product</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-3 text-right">Unit Price</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>
                {items
                  .filter((i) => Boolean(i.productId))
                  .map((item, idx) => {
                    const prod = products.find((p) => p.id === item.productId);
                    if (!prod) return null;
                    const lineTotal = item.quantity * item.unitPrice;
                    const realIdx = items.findIndex((i) => i.key === item.key);

                    return (
                      <div
                        key={item.key}
                        className="ledger-row grid grid-cols-12 gap-2 items-center py-3 px-1"
                      >
                        <div className="col-span-5 min-w-0">
                          <div className="font-bold text-[0.9375rem] text-ink break-words">{prod.name}</div>
                          <div className="text-[0.875rem] text-ink-2 num break-all">{prod.sku}</div>
                        </div>
                        <div className="col-span-2 text-center text-[1.0625rem] font-black num text-ink">
                          {item.quantity}
                        </div>
                        <div className="col-span-3 flex justify-end">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateItemPrice(realIdx, parseFloat(e.target.value) || 0)
                            }
                            className="field !py-2 !px-2 !text-[0.9375rem] text-right num"
                            aria-label={`Unit price per crate for ${prod.name}`}
                          />
                        </div>
                        <div className="col-span-2 text-right text-[1.0625rem] font-black num text-ink">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Totals */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-zinc-500">
                  <span>Subtotal ({totalCratesSold} crates)</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Special Discount</span>
                    <span className="font-semibold tabular-nums">− {formatCurrency(discountNum)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-black text-base text-zinc-900 dark:text-zinc-100 pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
                  <span>Total Payable</span>
                  <span className="tabular-nums">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Payment Method</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 uppercase">{paymentMethod.replace("_", " ")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Amount Received</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatCurrency(paidAmountNum)}</span>
                </div>
                {changeDue > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span className="font-medium">Change Due</span>
                    <span className="font-black tabular-nums">{formatCurrency(changeDue)}</span>
                  </div>
                )}
                {creditAmount > 0 && (
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                    <span className="font-medium">Credit (Unpaid)</span>
                    <span className="font-black tabular-nums">{formatCurrency(creditAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t-2 border-rule-strong flex flex-wrap gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="btn flex-1 min-w-40"
              >
                ← Back to Edit
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => formRef.current?.requestSubmit()}
                disabled={isPending}
                title="Record this sale (Enter)"
                className="btn btn-primary flex-[2] min-w-52"
              >
                {isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <IconCheck className="w-4 h-4 stroke-[3]" />
                    <span>Confirm &amp; Record Sale</span>
                    <kbd className="text-[0.875rem] font-mono font-bold opacity-80 bg-white/20 px-1.5 py-0.5 rounded">Ctrl+↵</kbd>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Product Browser Pop-up - the full catalogue, on demand only       */}
      {/* ================================================================ */}
      {browserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60"
          role="dialog"
          aria-modal="true"
          aria-label="Product catalogue"
        >
          <div ref={browserPanelRef} className="bg-surface text-ink rounded-lg border-2 border-rule-strong w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b-2 border-rule-strong shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded bg-navy text-white flex items-center justify-center shrink-0">
                  <IconPackage className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-ink leading-tight">Product Catalogue</h2>
                  <p className="text-[0.9375rem] text-ink-2 num">
                    Showing {filteredProducts.length} of {products.length} products
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBrowserOpen(false)}
                className="btn btn-sm shrink-0 !min-h-11 !px-2"
                aria-label="Close the product catalogue"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>

            {/* Search + brand filter stay pinned while the list scrolls */}
            <div className="px-5 py-4 border-b-2 border-rule-strong space-y-3 shrink-0">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3 pointer-events-none" />
                <input
                  id="pos-browser-search"
                  ref={browserSearchRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredProducts.length === 1) {
                      e.preventDefault();
                      const only = filteredProducts[0];
                      if (only.currentStock > 0) {
                        handleAddProductToTicket(only, 1);
                        setSearchQuery("");
                      }
                    }
                  }}
                  placeholder="Search by name, brand or SKU..."
                  autoComplete="off"
                  className="field !pl-11 !pr-14"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="btn btn-sm absolute right-1.5 top-1/2 -translate-y-1/2 !min-h-11 !min-w-11 !px-2 !py-1"
                    aria-label="Clear the catalogue search box"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
                              {/* Brand Filter Pills */}
                              <div>
                                <span className="block text-[0.9375rem] font-bold text-ink-2 mb-1">Filter by Brand</span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedBrand("ALL")}
                                    aria-pressed={selectedBrand === "ALL"}
                                    className={`btn ${
                                      selectedBrand === "ALL" ? "btn-primary" : ""
                                    }`}
                                  >
                                    All Brands
                                  </button>
                                  {brands.map((b) => {
                                    const isSelected = selectedBrand.toLowerCase() === b.toLowerCase();
                                    return (
                                      <button
                                        key={b}
                                        type="button"
                                        onClick={() => setSelectedBrand(b)}
                                        aria-pressed={isSelected}
                                        className={`btn ${isSelected ? "btn-primary" : ""}`}
                                      >
                                        {b}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
              <p className="text-[0.9375rem] text-ink-2">
                Added items stay on the ticket, so leave this open to keep adding.
              </p>
            </div>

            {/* The list */}
            <div className="overflow-y-auto px-5 py-4">
                          <div className="panel">
                            {filteredProducts.length === 0 ? (
                              <div className="py-12 text-center p-8">
                                <IconPackage className="w-10 h-10 text-ink-3 mx-auto mb-2" />
                                <h4 className="text-lg font-bold text-ink">No products match your search</h4>
                                <p className="text-[0.9375rem] text-ink-2 mt-1">
                                  Check the spelling, or clear the filters to see all products.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => { setSearchQuery(""); setSelectedBrand("ALL"); }}
                                  className="btn mt-4"
                                >
                                  Clear Search and Brand Filter
                                </button>
                              </div>
                            ) : (
                              <div>
                                {/* Column headers */}
                                <div className="ledger-head grid grid-cols-12 gap-2 px-4">
                                  <div className="col-span-5">Product</div>
                                  <div className="col-span-2 hidden sm:block">Type</div>
                                  <div className="col-span-2 text-center hidden sm:block">Stock</div>
                                  <div className="col-span-2 sm:col-span-1 text-right">Price</div>
                                  <div className="col-span-5 sm:col-span-2 text-right">Quantity</div>
                                </div>

                                {filteredProducts.map((prod) => {
                                  const currentPrice = getProductDefaultPrice(prod, saleType);
                                  const inStock = prod.currentStock > 0;
                                  const isLowStock = prod.currentStock <= 10 && inStock;
                                  const itemInCart = items.find((i) => i.productId === prod.id);
                                  const qtyInCart = itemInCart?.quantity || 0;
                                  const cartIdx = items.findIndex((i) => i.productId === prod.id);
                                  const brandStyle = getBrandStyle(prod.brand);
                                  const isGlass = prod.crateConfig?.hasGlassCrate !== false;

                                  return (
                                    <div
                                      key={prod.id}
                                      className={`ledger-row grid grid-cols-12 gap-2 px-4 py-3 items-center ${
                                        qtyInCart > 0 ? "ledger-row-active" : ""
                                      }`}
                                    >
                                      {/* Product Name + Brand + SKU */}
                                      <div className="col-span-5 min-w-0 flex items-start gap-2">
                                        {qtyInCart > 0 && (
                                          <span className="shrink-0 mt-1 w-5 h-5 bg-navy text-white rounded-full flex items-center justify-center">
                                            <IconCheck className="w-3 h-3 stroke-[3]" />
                                          </span>
                                        )}
                                        <div className="min-w-0">
                                          <div className={`text-[0.9375rem] font-bold break-words ${qtyInCart > 0 ? "text-navy" : "text-ink"}`}>
                                            {prod.name}
                                          </div>
                                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                            <span className={`text-[0.875rem] font-black uppercase px-1.5 py-0.5 rounded border ${brandStyle.bg} ${brandStyle.text} ${brandStyle.border}`}>
                                              {prod.brand}
                                            </span>
                                            {prod.sku && (
                                              <span className="text-[0.875rem] text-ink-2 num break-all">{prod.sku}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Packaging Type */}
                                      <div className="col-span-2 hidden sm:flex items-center">
                                        {isGlass ? (
                                          <span className="inline-flex items-center gap-1 text-[0.9375rem] font-bold px-2 py-0.5 rounded bg-navy-wash text-navy border border-navy/30">
                                            <IconBottle className="w-3.5 h-3.5" />
                                            <span>Glass {prod.crateConfig?.bottlesPerCrate || 24}b</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[0.9375rem] font-bold px-2 py-0.5 rounded bg-surface-alt text-ink-2 border border-rule">
                                            <IconPackage className="w-3.5 h-3.5" />
                                            <span>PET</span>
                                          </span>
                                        )}
                                      </div>

                                      {/* Stock Level */}
                                      <div className="col-span-2 text-center hidden sm:block">
                                        {inStock ? (
                                          <span className={`badge ${isLowStock ? "badge-warn" : "badge-good"}`}>
                                            {prod.currentStock} crates
                                          </span>
                                        ) : (
                                          <span className="badge badge-bad">Out of stock</span>
                                        )}
                                      </div>

                                      {/* Unit Price */}
                                      <div className="col-span-2 sm:col-span-1 text-right">
                                        <span className="text-[0.9375rem] font-black text-ink num">
                                          {formatCurrency(currentPrice)}
                                        </span>
                                        <span className="block text-[0.875rem] text-ink-2">per crate</span>
                                      </div>

                                      {/* Quantity Stepper */}
                                      <div className="col-span-5 sm:col-span-2 flex items-center justify-end gap-1.5">
                                        {inStock ? (
                                          qtyInCart > 0 ? (
                                            <div className="flex items-center bg-surface border-2 border-navy rounded-md">
                                              <button
                                                type="button"
                                                onClick={() => handleAddProductToTicket(prod, -1)}
                                                className="w-11 h-11 flex items-center justify-center text-xl font-bold text-ink hover:bg-surface-alt"
                                                aria-label={`Remove one crate of ${prod.name}`}
                                              >
                                                −
                                              </button>
                                              <input
                                                type="number"
                                                min="1"
                                                max={prod.currentStock}
                                                value={qtyInCart}
                                                onChange={(e) =>
                                                  handleUpdateItemQuantity(cartIdx, parseInt(e.target.value, 10) || 1)
                                                }
                                                onClick={(e) => (e.target as HTMLInputElement).select()}
                                                className="w-14 h-11 text-center text-[0.9375rem] font-black num bg-transparent focus:outline-none text-navy"
                                                aria-label={`Quantity of ${prod.name} in the ticket`}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleAddProductToTicket(prod, 1)}
                                                className="w-11 h-11 flex items-center justify-center text-xl font-bold text-navy hover:bg-navy-wash"
                                                aria-label={`Add one more crate of ${prod.name}`}
                                              >
                                                +
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleAddProductToTicket(prod, 1)}
                                              className="btn btn-primary"
                                            >
                                              <IconPlus className="w-4 h-4" />
                                              Add to Ticket
                                            </button>
                                          )
                                        ) : (
                                          <span className="text-[0.9375rem] text-ink-3 font-semibold italic">Out of stock</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
            </div>
          </div>
        </div>
      )}


      {/* ================================================================ */}
      {/* Main POS Form                                                     */}
      {/* ================================================================ */}
      <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="w-full">
        <input type="hidden" name="items" value={JSON.stringify(payloadItems)} />
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="saleType" value={saleType} />
        <input type="hidden" name="discount" value={discount} />
        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <input type="hidden" name="paidAmount" value={paidAmount} />
        <input type="hidden" name="plasticCrates" value={plasticCrates.toString()} />
        <input type="hidden" name="glassBottles" value={glassBottles.toString()} />

        {/* Error Banner */}
        {(clientError || state?.error) && (
          <div
            role="alert"
            className="mb-4 p-4 rounded-lg bg-stamp-wash border-2 border-stamp text-stamp font-medium flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-5 h-5 shrink-0" />
              <span>{clientError || state?.error}</span>
            </div>
            <button
              type="button"
              onClick={() => setClientError(null)}
              className="btn btn-sm"
            >
              Dismiss
            </button>
          </div>
        )}


        {/* POS Layout: add a product, then the ticket, then payment at the bottom */}
        <div className="space-y-6">
          {/* ============================================================= */}
          {/* ============================================================= */}
          {/* STEP 1 — ADD A PRODUCT: search for it, or open the catalogue  */}
          {/* ============================================================= */}
          <div className="panel">
            <div className="panel-body">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                {/* Search Bar — results appear inline, never the whole list */}
                <div className="flex-1">
                  <label
                    htmlFor="pos-product-search"
                    className="block text-[0.9375rem] font-bold text-ink-2 mb-1"
                  >
                    Add a Product <span className="text-ink-3 font-semibold">(name or scan barcode)</span>
                  </label>
                  <div className="relative">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3 pointer-events-none" />
                    <input
                      id="pos-product-search"
                      ref={searchInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const q = searchQuery.trim().toLowerCase();
                          if (!q) return;

                          const exactSku = products.find((p) => p.sku && p.sku.toLowerCase() === q);
                          if (exactSku && exactSku.currentStock > 0) {
                            handleAddProductToTicket(exactSku, 1);
                            setSearchQuery("");
                            return;
                          }

                          const exactName = products.find((p) => p.name.toLowerCase() === q);
                          if (exactName && exactName.currentStock > 0) {
                            handleAddProductToTicket(exactName, 1);
                            setSearchQuery("");
                            return;
                          }

                          if (filteredProducts.length === 1 && filteredProducts[0].currentStock > 0) {
                            handleAddProductToTicket(filteredProducts[0], 1);
                            setSearchQuery("");
                            return;
                          }
                        }
                      }}
                      placeholder="Type a product name…"
                      autoComplete="off"
                      className="field !pl-11 !pr-14"
                    />

                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="btn btn-sm !min-h-11 !min-w-11 !px-2 !py-1"
                          aria-label="Clear the product search box"
                        >
                          <IconClose className="w-4 h-4" />
                        </button>
                      ) : (
                        <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[0.9375rem] font-mono font-bold rounded border border-rule bg-surface-alt text-ink-2">
                          F2
                        </kbd>
                      )}
                    </div>
                  </div>
                </div>

                {/* The full catalogue opens in a pop-up, never on the page */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBrowserOpen(true)}
                    className="btn btn-primary"
                    title="Open the product catalogue (F3)"
                  >
                    <IconPackage className="w-4 h-4" />
                    <span>Browse All Products</span>
                    <kbd className="px-1.5 py-0.5 text-[0.9375rem] font-mono font-bold bg-white/20 border border-white/40 rounded">
                      F3
                    </kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShortcutsModalOpen(true)}
                    className="btn"
                    title="Keyboard Shortcuts (?)"
                  >
                    <IconKeyboard className="w-4 h-4" />
                    <span>Keys</span>
                    <kbd className="px-1.5 py-0.5 text-[0.9375rem] font-mono font-bold bg-surface-alt border border-rule rounded">
                      ?
                    </kbd>
                  </button>
                </div>
              </div>
            </div>

            {/* Search results: what was asked for, capped so the page stays short */}
            {searchQuery.trim().length > 0 && (
              <div
                className="border-t-2 border-rule-strong"
                aria-live="polite"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2 bg-surface-alt border-b border-rule">
                  <span className="text-[0.9375rem] font-bold text-ink-2 num">
                    {filteredProducts.length === 0
                      ? "No products match"
                      : `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""} match`}
                  </span>
                  {filteredProducts.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="btn btn-sm"
                    >
                      Clear Search
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBrowserOpen(true)}
                      className="btn btn-sm"
                      title="Open the product catalogue (F3)"
                    >
                      <IconPackage className="w-4 h-4" />
                      <span>Open Catalogue</span>
                      <kbd className="px-1.5 py-0.5 text-[0.875rem] font-mono font-bold bg-surface-alt border border-rule rounded">
                        F3
                      </kbd>
                    </button>
                  )}
                </div>

                {filteredProducts.length === 0 ? (
                  <p className="px-4 py-5 text-[0.9375rem] text-ink-2">
                    Nothing matches &ldquo;{searchQuery.trim()}&rdquo;. Check the spelling, or open the
                    catalogue to browse by brand.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
                    {filteredProducts.slice(0, TILE_RESULT_CAP).map((prod) => {
                      const inStock = prod.currentStock > 0;
                      const qtyInCart = items.find((i) => i.productId === prod.id)?.quantity || 0;
                      const price = getProductDefaultPrice(prod, saleType);

                      // The whole tile is the button, so the target is the full
                      // square rather than a small "Add" strip inside a row.
                      const tileLabel = [
                        inStock
                          ? `Add one crate of ${prod.name}`
                          : `${prod.name} is out of stock`,
                        `${formatCurrency(price)} per crate`,
                        inStock ? `${prod.currentStock} in stock` : null,
                        qtyInCart > 0 ? `${qtyInCart} already in the ticket` : null,
                      ]
                        .filter(Boolean)
                        .join(", ");

                      return (
                        <li key={prod.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => handleAddProductToTicket(prod, 1)}
                            disabled={!inStock}
                            aria-label={tileLabel}
                            title={tileLabel}
                            className={`w-full aspect-square min-h-40 flex flex-col justify-between gap-2 p-3 rounded-lg border-2 text-left transition-colors ${
                              inStock
                                ? "border-rule bg-surface hover:bg-surface-alt hover:border-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy cursor-pointer"
                                : "border-rule bg-surface-alt cursor-not-allowed"
                            }`}
                          >
                            <span className="flex items-start justify-between gap-1 min-w-0">
                              <span className="text-[0.9375rem] font-bold text-ink leading-snug line-clamp-2">
                                {prod.name}
                              </span>
                              {qtyInCart > 0 && (
                                <span className="badge badge-good shrink-0 num">
                                  {qtyInCart}
                                </span>
                              )}
                            </span>

                            <span className="block min-w-0">
                              <span className="block text-[0.875rem] text-ink-2 truncate">
                                {prod.brand}
                              </span>
                              <span
                                className={`block text-[0.9375rem] font-black num ${
                                  inStock ? "text-navy" : "text-ink-3"
                                }`}
                              >
                                {formatCurrency(price)}
                              </span>
                              <span className="block text-[0.875rem] text-ink-2 num">
                                {inStock ? `${prod.currentStock} in stock` : "Out of stock"}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {filteredProducts.length > TILE_RESULT_CAP && (
                  <p className="px-4 py-2 border-t border-rule text-[0.9375rem] text-ink-2">
                    {filteredProducts.length - TILE_RESULT_CAP} more match. Open the catalogue to see
                    all {filteredProducts.length}.
                  </p>
                )}
              </div>
            )}
          </div>


          {/* ============================================================= */}
          {/* STEP 2 — ADDED PRODUCTS: one row per product, in columns      */}
          {/* ============================================================= */}
          <section className="space-y-4">
            <div className="panel">
              <div className="panel-head flex flex-wrap items-center justify-between !py-3 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded bg-navy text-white flex items-center justify-center font-black text-[0.9375rem] num">
                    TKT
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-ink leading-tight">Added Products</h2>
                    <span className="text-[0.9375rem] text-ink-2 num">
                      {items.length} item{items.length !== 1 ? "s" : ""} • {totalCratesSold} crate{totalCratesSold !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="btn btn-danger btn-sm"
                  >
                    Clear Ticket
                  </button>
                )}
              </div>

              <div className="panel-body">
                {items.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-rule rounded-md p-4">
                    <IconReceipt className="w-9 h-9 text-ink-3 mx-auto mb-2" />
                    <p className="text-[1.0625rem] font-bold text-ink">No products added yet</p>
                    <p className="text-[0.9375rem] text-ink-2 mt-1">
                      Pick a product from the list above to start this ticket.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="ledger-head grid grid-cols-12 gap-2 px-1 hidden sm:grid">
                      <div className="col-span-4">Product</div>
                      <div className="col-span-3">Quantity</div>
                      <div className="col-span-2 text-right">Rate ✎</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-1" />
                    </div>

                    {items.map((item, idx) => {
                      const prod = products.find((p) => p.id === item.productId);
                      if (!prod) return null;
                      const lineTotal = item.quantity * item.unitPrice;

                      return (
                        <div
                          key={item.key}
                          className="ledger-row grid grid-cols-12 gap-2 px-1 py-3"
                        >
                          {/* Product */}
                          <div className="col-span-12 sm:col-span-4 min-w-0">
                            <div className="text-[0.9375rem] font-bold text-ink break-words">
                              {prod.name}
                            </div>
                            <div className="mt-0.5 text-[0.875rem] text-ink-2 break-words">
                              {prod.brand}
                              {prod.sku ? <span className="num"> · {prod.sku}</span> : null}
                            </div>
                          </div>

                          {/* Quantity: type it, or step it */}
                          <div className="col-span-6 sm:col-span-3 flex items-center">
                            <div className="flex items-center bg-surface border-2 border-rule-strong rounded-md">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(idx, item.quantity - 1)}
                                className="w-11 h-11 flex items-center justify-center text-xl font-bold text-ink hover:bg-surface-alt"
                                aria-label={`Remove one crate of ${prod.name} from the ticket`}
                              >
                                &minus;
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={prod.currentStock}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItemQuantity(idx, parseInt(e.target.value, 10) || 1)
                                }
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                                className="w-14 h-11 text-center text-[0.9375rem] font-black num bg-transparent focus:outline-none text-navy"
                                aria-label={`Quantity of ${prod.name} in the ticket`}
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(idx, item.quantity + 1)}
                                className="w-11 h-11 flex items-center justify-center text-xl font-bold text-navy hover:bg-navy-wash"
                                aria-label={`Add one more crate of ${prod.name} to the ticket`}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Rate — editable inline */}
                          <div className="col-span-6 sm:col-span-2 flex items-center justify-end">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)
                              }
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              className="field !py-2 !px-2 !text-[0.9375rem] text-right num w-28"
                              aria-label={`Unit rate per crate for ${prod.name}`}
                            />
                          </div>

                          {/* Amount */}
                          <div className="col-span-10 sm:col-span-2 text-right">
                            <span className="sm:hidden text-[0.875rem] text-ink-2">Amount </span>
                            <span className="text-[1.0625rem] font-black text-navy num">
                              {formatCurrency(lineTotal)}
                            </span>
                          </div>

                          {/* Remove */}
                          <div className="col-span-2 sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="btn btn-sm !min-h-11 !min-w-11 !px-2"
                              title={`Remove ${prod.name} from the ticket`}
                            >
                              <IconTrash className="w-4 h-4" />
                              <span className="sr-only">
                                Remove {prod.name} from the ticket
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* =========================================================== */}
            {/* STEP 3 — CUSTOMER, TOTALS AND PAYMENT                     */}
            {/* =========================================================== */}
            <div className="panel">
              <div className="panel-head flex flex-wrap items-center justify-between !py-3 gap-2">
                <h2 className="text-lg font-extrabold text-ink leading-tight">
                  Customer &amp; Payment
                </h2>
                <span className="text-[0.9375rem] text-ink-2 num">
                  {totalCratesSold} crate{totalCratesSold !== 1 ? "s" : ""} ·{" "}
                  {formatCurrency(totalAmount)} due
                </span>
              </div>

              <div className="panel-body space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Customer Selector & Pricing Tier */}
                <div className="space-y-2 bg-surface-alt p-3 rounded-md border border-rule">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="pos-customer" className="text-[0.9375rem] font-bold text-ink-2 flex items-center gap-1.5">
                      <span>Customer</span>
                      <kbd className="px-1.5 py-0.5 text-[0.875rem] font-mono font-bold bg-surface border border-rule rounded">
                        F4
                      </kbd>
                    </label>
                    {customerId && (
                      <button
                        type="button"
                        onClick={() => handleCustomerChange("")}
                        className="link-btn"
                      >
                        Switch to Walk-in
                      </button>
                    )}
                  </div>

                  <select
                    id="pos-customer"
                    ref={customerSelectRef}
                    value={customerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="field"
                  >
                    <option value="">Walk-in Customer (Cash Counter)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.priceTier}) {c.phone ? `— ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>

                  {selectedCustomer && (
                    <div className="pt-2 border-t border-rule grid grid-cols-3 gap-2 text-[0.9375rem]">
                      <div>
                        <span className="text-ink-2 block text-[0.875rem]">Owes Us</span>
                        <span className="font-extrabold text-warn num text-[1.0625rem]">
                          {formatCurrency(selectedCustomer.outstandingBalance)}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-2 block text-[0.875rem]">Price Tier</span>
                        <span className="font-extrabold text-ink uppercase">
                          {selectedCustomer.priceTier}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-2 block text-[0.875rem]">Credit</span>
                        <span className={`font-extrabold ${selectedCustomer.creditAllowed ? "text-good" : "text-stamp"}`}>
                          {selectedCustomer.creditAllowed ? "Allowed" : "Cash Only"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Price Tier Override Pills */}
                  <div>
                    <span className="text-[0.9375rem] text-ink-2 font-bold block mb-1">Price to charge</span>
                    <div className="flex flex-wrap gap-2">
                      {allowedSaleTypes.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleSaleTypeChange(t)}
                          aria-pressed={saleType === t}
                          className={`btn ${saleType === t ? "btn-primary" : ""}`}
                        >
                          {t.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Container Returns & Discounts */}
                <div className="space-y-3 bg-surface-alt p-3 rounded-md border border-rule h-fit">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label
                      htmlFor="pos-returnable-crates"
                      className="font-bold text-ink block text-[0.9375rem]"
                    >
                      {containerSettings?.enabledTypes?.plastic ? "Empty Crates Received:" : "Empty Returnable Crates:"}
                    </label>
                    <span className="text-[0.875rem] text-ink-2 block">
                      {returnableSummary.returnableCrates > 0
                        ? `Returnable sold: ${returnableSummary.returnableCrates} crates (${returnableSummary.expectedBottles} bottles)`
                        : "No returnable crates (PET/Can)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="pos-returnable-crates"
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
                      className="field !w-20 !px-2 text-center num"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={handleAutoFillContainers}
                      disabled={returnableSummary.returnableCrates === 0}
                      className="btn"
                      title="Match with returnable crates sold (F7)"
                    >
                      <span>Match ({returnableSummary.returnableCrates})</span>
                      <kbd className="text-[0.875rem] font-mono opacity-70">F7</kbd>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="pos-discount" className="font-bold text-ink-2 text-[0.9375rem]">
                    Special Discount (Rs.):
                  </label>
                  <input
                    id="pos-discount"
                    type="number"
                    min="0"
                    step="any"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="field !w-32 text-right num"
                    placeholder="0"
                  />
                </div>
              </div>

                </div>

              {/* Totals & Grand Total Banner */}
              <div className="p-4 rounded-md bg-navy-deep text-white space-y-2">
                <div className="flex items-center justify-between text-[0.9375rem] text-white/80">
                  <span>Subtotal ({totalCratesSold} crates):</span>
                  <span className="num font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex items-center justify-between text-[0.9375rem] text-white/90">
                    <span>Discount:</span>
                    <span className="num font-semibold">− {formatCurrency(discountNum)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-white/25 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[0.875rem] uppercase tracking-wider font-bold text-white/80 block">
                      Total Payable
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-white num">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[0.875rem] uppercase font-bold text-white/80 block">Payment</span>
                    <span className="text-[1.0625rem] font-extrabold text-white uppercase">
                      {paymentMethod.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Payment Method Selector Pills */}
              <div className="space-y-2">
                <span className="text-[0.9375rem] font-bold text-ink-2 block">
                  How is the customer paying?
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      aria-pressed={paymentMethod === pm.method}
                      className={`btn ${paymentMethod === pm.method ? "btn-primary" : ""}`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Tender Row & Shortcuts */}
              <div className="space-y-2 bg-surface-alt p-3 rounded-md border border-rule h-fit">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="pos-amount-received" className="text-[0.9375rem] font-bold text-ink flex items-center gap-1.5">
                    <span>Amount Received (Rs.)</span>
                    <kbd className="px-1.5 py-0.5 text-[0.875rem] font-mono font-bold bg-surface border border-rule rounded">
                      F9
                    </kbd>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPaidAmount("0")}
                      className="link-btn"
                    >
                      Rs. 0 (Credit)
                    </button>
                    <span className="text-rule-strong" aria-hidden="true">|</span>
                    <button
                      type="button"
                      onClick={handlePayInFull}
                      className="link-btn"
                      title="Exact Tender / Pay in Full (F8)"
                    >
                      <span>Exact</span>
                      <kbd className="px-1.5 py-0.5 text-[0.875rem] font-mono bg-surface border border-rule rounded">F8</kbd>
                    </button>
                  </div>
                </div>

                <input
                  id="pos-amount-received"
                  ref={paidAmountInputRef}
                  type="number"
                  min="0"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="field !text-2xl !font-black num"
                />

                {/* Quick Cash Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[500, 1000, 5000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleAddQuickCash(val)}
                      className="btn num !px-1 !min-w-0"
                    >
                      +{val}
                    </button>
                  ))}
                </div>

                {/* Change Due or Remaining Credit Indicator */}
                {paidAmountNum > totalAmount && (
                  <div className="pt-2 border-t border-rule flex items-center justify-between text-[0.9375rem] font-bold text-good">
                    <span>Change Due to Customer:</span>
                    <span className="text-[1.0625rem] font-black num">{formatCurrency(changeDue)}</span>
                  </div>
                )}

                {creditAmount > 0 && (
                  <div className="pt-2 border-t border-rule flex items-center justify-between text-[0.9375rem] font-bold text-warn">
                    <span>Credit Balance (Unpaid):</span>
                    <span className="text-[1.0625rem] font-black num">{formatCurrency(creditAmount)}</span>
                  </div>
                )}
              </div>
              </div>

              {/* Main Action: Open Invoice Modal */}
              <button
                type="button"
                onClick={handleOpenInvoiceModal}
                disabled={isPending || items.length === 0}
                className="btn btn-primary btn-lg w-full !text-xl"
                title="Preview invoice and submit (Ctrl + Enter)"
              >
                <>
                  <IconReceipt className="w-5 h-5" />
                  <span>
                    REVIEW &amp; SUBMIT — {formatCurrency(totalAmount)}
                  </span>
                  <kbd className="text-[0.875rem] font-mono font-bold opacity-80 bg-white/20 px-2 py-0.5 rounded ml-2 hidden sm:inline-block">
                    Ctrl+↵
                  </kbd>
                </>
              </button>
              </div>
            </div>
          </section>
        </div>

        {/* Cashier Quick-Keys Helper Bar */}
        <div className="hidden lg:flex items-center justify-between gap-3 px-4 py-3 bg-surface-alt border-2 border-rule rounded-md text-[0.9375rem] text-ink-2 mt-4 flex-wrap">
          <div className="flex items-center gap-3.5 flex-wrap">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <IconKeyboard className="w-4 h-4" />
              <span>Hotkeys:</span>
            </span>
            {[
              ["F2", "Search"],
              ["F3", "Browse Catalogue"],
              ["Enter", "Scan Barcode"],
              ["F4", "Customer"],
              ["F7", "Match Empties"],
              ["F8", "Pay in Full"],
              ["F9", "Tender"],
              ["Ctrl+↵", "Review & Submit"],
            ].map(([key, label]) => (
              <span key={key} className="flex items-center gap-1">
                <kbd className="font-mono font-bold bg-surface border border-rule-strong px-1.5 py-0.5 rounded text-[0.875rem]">{key}</kbd>
                <span>{label}</span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(true)}
            className="link-btn shrink-0"
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
    </>
  );
}
