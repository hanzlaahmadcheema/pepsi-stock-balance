"use client";

import { useState, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SaleType, PaymentMethod, PriceTier } from "@prisma/client";
import { createSaleAction } from "../actions";
import { formatCurrency } from "@/lib/formatters";
import { CrateStepper } from "@/components/ui/crate-stepper";
import type { StaffProductListItem } from "@/lib/products/service";
import type { CustomerSummary } from "@/lib/customers/service";

type ProductOption = StaffProductListItem;
type CustomerOption = CustomerSummary;

type FormLineItem = {
  key: string;
  productId: string;
  quantity: number;
  unitPrice: number;
};

export function CreateSaleForm({
  products,
  customers,
  initialCustomerId,
}: {
  products: ProductOption[];
  customers: CustomerOption[];
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createSaleAction, null);
  const [clientError, setClientError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>(initialCustomerId || "");
  const [saleType, setSaleType] = useState<SaleType>(SaleType.RETAIL);
  const [discount, setDiscount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paidAmount, setPaidAmount] = useState<string>("0");
  const [plasticCrates, setPlasticCrates] = useState<number>(0);
  const [glassBottles, setGlassBottles] = useState<number>(0);

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

  const [items, setItems] = useState<FormLineItem[]>(() => {
    const initialProd = products[0];
    const initialPrice = initialProd ? getProductDefaultPrice(initialProd, SaleType.RETAIL) : 0;
    return [
      {
        key: "initial-0",
        productId: initialProd?.id || "",
        quantity: 1,
        unitPrice: initialPrice,
      },
    ];
  });

  // When customer changes, optionally sync saleType to customer's priceTier
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

  // Handle product selection in a row
  const handleProductSelect = (index: number, newProductId: string) => {
    const product = products.find((p) => p.id === newProductId);
    const defaultPrice = product ? getProductDefaultPrice(product, saleType) : 0;

    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: newProductId,
        unitPrice: defaultPrice,
      };
      return next;
    });
  };

  // When sale type changes, update unit prices that match default price
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

  const handleAddItem = () => {
    // Pick the first product that is in stock and not yet selected if possible
    const unselected = products.find((p) => !items.some((i) => i.productId === p.id) && p.currentStock > 0);
    const fallbackProd = unselected || products[0];
    const defaultPrice = fallbackProd ? getProductDefaultPrice(fallbackProd, saleType) : 0;

    setItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${Math.random()}`,
        productId: fallbackProd?.id || "",
        quantity: 1,
        unitPrice: defaultPrice,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate live totals
  const subtotal = items.reduce((acc, item) => {
    if (!item.productId) return acc;
    return acc + item.quantity * item.unitPrice;
  }, 0);

  const discountNum = parseFloat(discount) || 0;
  const totalAmount = Math.max(0, Math.round((subtotal - discountNum) * 100) / 100);
  const paidAmountNum = parseFloat(paidAmount) || 0;
  const creditAmount = Math.max(0, Math.round((totalAmount - paidAmountNum) * 100) / 100);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Quick paid in full button
  const handlePayInFull = () => {
    setPaidAmount(totalAmount.toFixed(2));
  };

  // Check if any product has over-requested stock
  const hasOverStock = items.some((item) => {
    if (!item.productId) return false;
    const prod = products.find((p) => p.id === item.productId);
    return prod ? item.quantity > prod.currentStock : false;
  });

  // Redirect on successful creation
  useEffect(() => {
    if (state?.success && state.saleId) {
      router.push(`/sales/${state.saleId}`);
    }
  }, [state?.success, state?.saleId, router]);

  // Prepare submission payload
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const validItems = items.filter((i) => Boolean(i.productId));
    if (validItems.length === 0) {
      e.preventDefault();
      setClientError("Please select at least one product.");
      return;
    }

    if (hasOverStock) {
      e.preventDefault();
      setClientError("One or more items exceed available warehouse stock. Please adjust quantities.");
      return;
    }

    if (creditAmount > 0 && !customerId) {
      e.preventDefault();
      setClientError("Anonymous sales cannot be on credit. Please collect full payment or select a registered Customer.");
      return;
    }

    if (creditAmount > 0 && selectedCustomer && !selectedCustomer.creditAllowed) {
      e.preventDefault();
      setClientError(`Customer "${selectedCustomer.name}" is not approved for credit purchases.`);
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
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(payloadItems)} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="saleType" value={saleType} />
      <input type="hidden" name="plasticCrates" value={plasticCrates.toString()} />
      <input type="hidden" name="glassBottles" value={glassBottles.toString()} />

      {/* Accessible Inline Error Banner */}
      {(clientError || state?.error) && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-medium flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">Error:</span>
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

      {/* Section 1: Customer & Pricing Tier */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
              1
            </span>
            Customer & Pricing Tier
          </h2>
          <span className="text-xs text-zinc-500">Step 1 of 3</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="customerSelect"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2"
            >
              Customer Account
            </label>
            <div className="flex gap-2">
              <select
                id="customerSelect"
                autoFocus={!initialCustomerId}
                value={customerId}
                onChange={(e) => {
                  setClientError(null);
                  handleCustomerChange(e.target.value);
                }}
                className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">— Anonymous (Cash / Immediate Sale) —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""} — {c.priceTier}{" "}
                    {c.creditAllowed ? "• Credit Allowed" : "• No Credit"}
                  </option>
                ))}
              </select>
              <Link
                href="/customers"
                className="px-3 py-2.5 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 whitespace-nowrap transition-colors flex items-center"
              >
                + New Customer
              </Link>
            </div>

            {selectedCustomer ? (
              <div className="mt-2.5 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 text-xs flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-zinc-500">Tier: </span>
                  <b className="text-zinc-800 dark:text-zinc-200">{selectedCustomer.priceTier}</b>
                </div>
                <div>
                  <span className="text-zinc-500">Credit Status: </span>
                  <b className={selectedCustomer.creditAllowed ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-600"}>
                    {selectedCustomer.creditAllowed ? "✓ Approved" : "✕ Not Allowed"}
                  </b>
                </div>
                <div>
                  <span className="text-zinc-500">Current Balance: </span>
                  <b className={selectedCustomer.outstandingBalance > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-zinc-700 dark:text-zinc-300"}>
                    {formatCurrency(selectedCustomer.outstandingBalance)}
                  </b>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                Anonymous sale: Cash or instant counter payment. No credit balance or returnable container ledger tracked.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
              Price Tier
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: SaleType.RETAIL, label: "Retail" },
                { type: SaleType.WHOLESALE, label: "Wholesale" },
                { type: SaleType.KEY_ACCOUNT, label: "Key Account" },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSaleTypeChange(type)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                    saleType === type
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Selling prices update automatically to match the selected price tier.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Products & Crate Quantities */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
              2
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Products & Crate Quantities
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Full crates only. Enter quantity using steppers or direct typing.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-colors cursor-pointer"
          >
            + Add Another Product
          </button>
        </div>

        <div className="p-6 space-y-4">
          {items.map((item, index) => {
            const selectedProduct = products.find((p) => p.id === item.productId);
            const lineTotal = item.quantity * item.unitPrice;
            const isOverStock = selectedProduct ? item.quantity > selectedProduct.currentStock : false;

            return (
              <div
                key={item.key}
                className={`p-4 rounded-xl border transition-colors ${
                  isOverStock
                    ? "border-red-300 dark:border-red-900/80 bg-red-50/40 dark:bg-red-950/20"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Product Dropdown */}
                  <div className="flex-1">
                    <label
                      htmlFor={`product-${index}`}
                      className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
                    >
                      Product #{index + 1} *
                    </label>
                    <select
                      id={`product-${index}`}
                      value={item.productId}
                      onChange={(e) => handleProductSelect(index, e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Product --</option>
                      {products.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={p.currentStock <= 0 && item.productId !== p.id}
                        >
                          {p.name} ({p.brand}) — {p.currentStock} crates in stock
                          {p.currentStock <= 0 ? " [OUT OF STOCK]" : ""}
                        </option>
                      ))}
                    </select>

                    {selectedProduct && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            selectedProduct.currentStock > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          Available Stock: {selectedProduct.currentStock} crates
                        </span>
                        {isOverStock && (
                          <span className="text-red-600 dark:text-red-400 font-bold">
                            ⚠️ Requested {item.quantity} exceeds available {selectedProduct.currentStock} crates!
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity Stepper */}
                  <div className="w-full sm:w-auto">
                    <label
                      htmlFor={`stepper-${index}`}
                      className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
                    >
                      Crates *
                    </label>
                    <CrateStepper
                      id={`stepper-${index}`}
                      value={item.quantity}
                      min={1}
                      max={selectedProduct?.currentStock && selectedProduct.currentStock > 0 ? selectedProduct.currentStock : undefined}
                      onChange={(val) => {
                        setItems((prev) => {
                          const next = [...prev];
                          next[index] = { ...next[index], quantity: Math.max(1, val) };
                          return next;
                        });
                      }}
                      isError={isOverStock}
                      ariaLabel={`Crate quantity for line ${index + 1}`}
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="w-full sm:w-36">
                    <label
                      htmlFor={`price-${index}`}
                      className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
                    >
                      Rate / Crate (Rs.) *
                    </label>
                    <input
                      id={`price-${index}`}
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setItems((prev) => {
                          const next = [...prev];
                          next[index] = { ...next[index], unitPrice: Math.max(0, val) };
                          return next;
                        });
                      }}
                      required
                      className="w-full h-10 px-3 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 tabular-nums"
                    />
                  </div>

                  {/* Line Total */}
                  <div className="w-full sm:w-36 text-left lg:text-right">
                    <div className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                      Line Total
                    </div>
                    <div className="text-base font-black text-zinc-900 dark:text-zinc-100 py-1.5 tabular-nums">
                      {formatCurrency(lineTotal)}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <div className="pt-1 lg:pt-5">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length <= 1}
                      title="Remove product"
                      aria-label={`Remove product line ${index + 1}`}
                      className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] sm:min-h-0 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all active:scale-95 disabled:active:scale-100"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-3 min-h-[44px] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            + Add Another Product Line
          </button>
        </div>
      </div>

      {/* Section 3: Payment & Totals */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
              3
            </span>
            Payment Collection & Invoice Summary
          </h2>
          <span className="text-xs text-zinc-500">Step 3 of 3</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Payment Configuration */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="paymentMethod"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Payment Method *
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value={PaymentMethod.CASH}>CASH</option>
                <option value={PaymentMethod.EASYPAISA}>EASYPAISA</option>
                <option value={PaymentMethod.JAZZCASH}>JAZZCASH</option>
                <option value={PaymentMethod.MPESA}>MPESA</option>
                <option value={PaymentMethod.QR}>QR CODE</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="paidAmount"
                  className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
                >
                  Amount Paid At Counter (Rs.) *
                </label>
                <button
                  type="button"
                  onClick={handlePayInFull}
                  className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 cursor-pointer transition-colors"
                >
                  Set Paid in Full ({formatCurrency(totalAmount)})
                </button>
              </div>
              <input
                id="paidAmount"
                type="number"
                name="paidAmount"
                step="0.01"
                min={0}
                max={totalAmount}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full px-3 py-2.5 text-lg font-black rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="discount"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Special Discount (Rs.)
              </label>
              <input
                id="discount"
                type="number"
                name="discount"
                step="0.01"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Container Ledger — only shown when a customer is selected */}
            {customerId && (
              <div className="border-t border-zinc-200 dark:border-zinc-750 pt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Containers Dispatched With Customer
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Plastic Crates
                    </label>
                    <CrateStepper
                      value={plasticCrates}
                      min={0}
                      onChange={setPlasticCrates}
                      ariaLabel="Plastic Crates dispatched"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Glass Bottles
                    </label>
                    <CrateStepper
                      value={glassBottles}
                      min={0}
                      onChange={setGlassBottles}
                      ariaLabel="Glass Bottles dispatched"
                    />
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  Debited to customer returnable container ledger. Leave 0 if customer supplied their own containers.
                </p>
              </div>
            )}
          </div>

          {/* Invoice Summary Box */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-zinc-200 dark:border-zinc-750 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {discountNum > 0 && (
                <div className="flex items-center justify-between text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Discount:</span>
                  <span className="tabular-nums">-{formatCurrency(discountNum)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-lg font-black text-zinc-900 dark:text-zinc-50 border-t border-zinc-200 dark:border-zinc-700 pt-2.5">
                <span>Total Invoice:</span>
                <span className="tabular-nums">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>Paid at Counter:</span>
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(paidAmountNum)}
                </span>
              </div>

              <div className="flex items-center justify-between text-base font-black border-t border-zinc-200 dark:border-zinc-700 pt-2.5">
                <span>Credit (Balance Due):</span>
                <span
                  className={creditAmount > 0 ? "text-amber-600 dark:text-amber-400 font-black text-lg tabular-nums" : "text-zinc-500 tabular-nums"}
                >
                  {formatCurrency(creditAmount)}
                </span>
              </div>

              {creditAmount > 0 && !customerId && (
                <div role="alert" className="p-3 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-semibold">
                  ⚠️ Anonymous sales cannot be on credit. Please collect the full amount or select a registered Customer.
                </div>
              )}

              {creditAmount > 0 && selectedCustomer && !selectedCustomer.creditAllowed && (
                <div role="alert" className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 font-semibold">
                  ⚠️ Customer &ldquo;{selectedCustomer.name}&rdquo; is not approved for credit purchases. Full counter payment is required.
                </div>
              )}

              {hasOverStock && (
                <div role="alert" className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 font-semibold">
                  ⚠️ One or more crate quantities exceed available warehouse stock.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <Link
                href="/sales"
                className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors focus:outline-hidden focus:ring-2 focus:ring-zinc-400"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={
                  isPending ||
                  hasOverStock ||
                  (creditAmount > 0 && !customerId) ||
                  Boolean(creditAmount > 0 && selectedCustomer && !selectedCustomer.creditAllowed)
                }
                className="px-6 py-2.5 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 inline-flex items-center gap-2"
              >
                {isPending && (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {isPending ? "Creating Sale..." : "Create Sale"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
