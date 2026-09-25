"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import Link from "next/link";
import { PriceTier } from "@prisma/client";
import { createCustomerAction, updateCustomerAction } from "./actions";
import { CustomerStatusButton } from "./customer-status-button";
import type { CustomerSummary } from "@/lib/customers/service";
import { formatCurrency } from "@/lib/formatters";
import { IconClose, IconUsers, IconPlus, IconHistory } from "@/components/ui/icons";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { EmptyState, StatusBadge } from "@/components/ui/classic";
import { isCloudPortal } from "@/lib/config/portal-mode";

/* =========================================================================
   ADD / EDIT A CUSTOMER
   Every label is spelled out, nothing relies on colour alone, and the two
   buttons at the bottom say exactly what they will do.
   ========================================================================= */
export function CustomerModal({
  customerToEdit,
  enabledRates = { retail: true, wholesale: true, key: true },
  onClose,
}: {
  customerToEdit?: CustomerSummary | null;
  isOwner?: boolean;
  enabledRates?: {
    retail: boolean;
    wholesale: boolean;
    key: boolean;
  };
  onClose: () => void;
}) {
  const isEditing = Boolean(customerToEdit);
  const actionToUse = isEditing ? updateCustomerAction : createCustomerAction;
  const [state, formAction, isPending] = useActionState(actionToUse, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        onClose();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state?.success, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
        className="panel my-auto w-full max-w-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-rule bg-surface-alt px-5 py-4">
          <h3 id="customer-modal-title" className="text-xl font-bold text-ink">
            {isEditing ? "Change Customer Details" : "Register a New Customer"}
          </h3>
          <button type="button" onClick={onClose} className="btn px-3" aria-label="Close without saving">
            <IconClose className="h-6 w-6" />
          </button>
        </div>

        <form ref={formRef} action={formAction} className="space-y-4 p-5">
          {isEditing && <input type="hidden" name="id" value={customerToEdit?.id} />}

          {state?.error ? (
            <p className="notice notice-bad" role="alert">
              <span>
                <strong>Not saved.</strong> {state.error}
              </span>
            </p>
          ) : null}

          {state?.success ? (
            <p className="notice notice-good" role="status">
              <span>
                <strong>Saved.</strong> This customer is now on your list.
              </span>
            </p>
          ) : null}

          <div>
            <label htmlFor="customer-name" className="label">
              Shop or customer name <span className="text-stamp">*</span>
            </label>
            <input
              id="customer-name"
              type="text"
              name="name"
              defaultValue={customerToEdit?.name || ""}
              required
              placeholder="For example: Al-Madina Store"
              className="field"
            />
            <p className="field-help">The name you will recognise on an invoice.</p>
          </div>

          <div>
            <label htmlFor="customer-phone" className="label">
              Phone number
            </label>
            <input
              id="customer-phone"
              type="text"
              name="phone"
              defaultValue={customerToEdit?.phone || ""}
              placeholder="For example: 0300 1234567"
              className="field"
            />
            <p className="field-help">Used to send balance reminders. Optional.</p>
          </div>

          <div>
            <label htmlFor="customer-address" className="label">
              Address or market area
            </label>
            <input
              id="customer-address"
              type="text"
              name="address"
              defaultValue={customerToEdit?.address || ""}
              placeholder="For example: Main Market, Shop 4"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="customer-tier" className="label">
              Which price do they get?
            </label>
            <select
              id="customer-tier"
              name="priceTier"
              defaultValue={customerToEdit?.priceTier || PriceTier.RETAIL}
              className="field"
            >
              {[
                { tier: PriceTier.RETAIL, label: "Retail price (one crate at a time)", enabled: enabledRates?.retail ?? true },
                { tier: PriceTier.WHOLESALE, label: "Wholesale price (bulk crates)", enabled: enabledRates?.wholesale ?? true },
                { tier: PriceTier.KEY_ACCOUNT, label: "Key account price (negotiated)", enabled: enabledRates?.key ?? true },
              ]
                .filter((t) => t.enabled || customerToEdit?.priceTier === t.tier)
                .map((t) => (
                  <option key={t.tier} value={t.tier}>
                    {t.label}
                  </option>
                ))}
            </select>
            <p className="field-help">This decides which price is used every time you sell to them.</p>
          </div>

          <div className="rounded-lg border-2 border-rule bg-surface-alt p-4">
            <label htmlFor="creditAllowed" className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                id="creditAllowed"
                name="creditAllowed"
                defaultChecked={customerToEdit?.creditAllowed ?? false}
                className="mt-1 h-6 w-6 shrink-0 cursor-pointer accent-navy"
              />
              <span>
                <span className="block text-base font-bold text-ink">Let this customer buy on credit</span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-2">
                  Tick this only if the shop is allowed to take goods now and pay later. Leave it off and every sale
                  must be paid in full.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t-2 border-rule pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn">
              Cancel, do not save
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary btn-lg">
              {isPending ? "Saving, please wait…" : isEditing ? "Save These Changes" : "Add This Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   CUSTOMER LIST
   The balance column is the reason this screen exists, so it is the largest
   number on the row and every row says who the customer is in plain words.
   ========================================================================= */
export function CustomerListWrapper({
  customers,
  isOwner,
}: {
  customers: CustomerSummary[];
  isOwner: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);
  const isCloud = isCloudPortal();

  const handleCreate = () => {
    setEditingCustomer(null);
    setModalOpen(true);
  };

  const handleEdit = (customer: CustomerSummary) => {
    setEditingCustomer(customer);
    setModalOpen(true);
  };

  const totalOwed = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
  const totalOwing = customers.filter((c) => c.outstandingBalance > 0).length;

  return (
    <>
      {/* ---------------- Page heading ---------------- */}
      <div className="panel">
        <div className="flex flex-col gap-4 border-b-2 border-rule bg-surface-alt px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">Customers &amp; Credit</h1>
              {isCloud ? <StatusBadge tone="info">Read-only portal</StatusBadge> : null}
            </div>
            <p className="mt-1 text-base text-ink-2">
              {isCloud
                ? "Customer accounts, money owed, and payment history as recorded at the depot."
                : "Who buys from you, who still owes money, and how to collect it."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {isCloud ? (
              <Link href="/reports/aging" className="btn">
                <IconHistory className="h-5 w-5" />
                Debt Aging Report
              </Link>
            ) : (
              <button type="button" onClick={handleCreate} className="btn btn-primary btn-lg">
                <IconPlus className="h-5 w-5" />
                Add Customer
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
          <div className="rounded-lg border-2 border-rule bg-surface-alt px-4 py-3">
            <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Customers on file</p>
            <p className="num mt-1 text-2xl font-bold">{customers.length}</p>
          </div>
          <div className="rounded-lg border-2 border-rule bg-surface-alt px-4 py-3">
            <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Total money owed to you</p>
            <p className="num mt-1 text-2xl font-bold text-warn">{formatCurrency(totalOwed)}</p>
          </div>
          <div className="rounded-lg border-2 border-rule bg-surface-alt px-4 py-3">
            <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Customers with a balance</p>
            <p className="num mt-1 text-2xl font-bold">{totalOwing}</p>
            <p className="text-sm text-ink-3">of {customers.length} on file</p>
          </div>
        </div>
      </div>

      {/* ---------------- Customer list ---------------- */}
      <div className="mt-6">
        {customers.length === 0 ? (
          <div className="panel p-6">
            <EmptyState
              title="No customers yet"
              hint="Add the shops, hotels and restaurants you sell to. Once they are on the list you can send them goods on credit and record what they pay back."
              action={
                isCloud ? undefined : (
                  <button type="button" onClick={handleCreate} className="btn btn-primary btn-lg">
                    <IconPlus className="h-5 w-5" />
                    Add the First Customer
                  </button>
                )
              }
            />
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <ScrollableTable>
              <table className="ledger">
                <caption className="sr-only">
                  Customers with phone number, price tier, credit permission, outstanding balance and status
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Phone &amp; Address</th>
                    <th scope="col">Price They Pay</th>
                    <th scope="col">Credit Allowed</th>
                    <th scope="col" className="num">
                      Money Owed To You
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/customers/${c.id}`} className="link text-base">
                          {c.name}
                        </Link>
                      </td>
                      <td>
                        <span className="block">{c.phone || "No phone saved"}</span>
                        {c.address ? <span className="block text-sm text-ink-3">{c.address}</span> : null}
                      </td>
                      <td>
                        <span className="text-base font-semibold">
                          {c.priceTier === PriceTier.KEY_ACCOUNT
                            ? "Key account"
                            : c.priceTier === PriceTier.WHOLESALE
                            ? "Wholesale"
                            : "Retail"}
                        </span>
                      </td>
                      <td>
                        {c.creditAllowed ? (
                          <StatusBadge tone="good">Credit allowed</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Pay in full</StatusBadge>
                        )}
                      </td>
                      <td className={`num text-xl font-bold ${c.outstandingBalance > 0 ? "text-warn" : "text-ink-3"}`}>
                        {formatCurrency(c.outstandingBalance)}
                      </td>
                      <td>
                        {c.isActive ? <StatusBadge tone="good">Active</StatusBadge> : <StatusBadge tone="neutral">Not in use</StatusBadge>}
                      </td>
                      <td className="num">
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          {isCloud ? (
                            <Link href={`/customers/${c.id}`} className="btn btn-sm">
                              Open Ledger
                            </Link>
                          ) : (
                            <>
                              <Link href={`/customers/${c.id}`} className="btn btn-sm">
                                Ledger
                              </Link>
                              {c.outstandingBalance > 0 ? (
                                <Link href={`/customers/${c.id}/payments`} className="btn btn-sm btn-primary">
                                  Take Payment
                                </Link>
                              ) : null}
                              {isOwner ? (
                                <>
                                  <button type="button" onClick={() => handleEdit(c)} className="btn btn-sm">
                                    Change Details
                                  </button>
                                  <CustomerStatusButton customerId={c.id} isActive={c.isActive} />
                                </>
                              ) : null}
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        )}
      </div>

      {customers.length > 0 ? (
        <p className="mt-4 text-sm text-ink-3">
          <IconUsers className="mr-1 inline h-4 w-4" aria-hidden="true" />
          Open <strong>&ldquo;Ledger&rdquo;</strong> to see every invoice and payment for one customer. Use{" "}
          <strong>&ldquo;Take Payment&rdquo;</strong> to record money received today.
        </p>
      ) : null}

      {modalOpen ? (
        <CustomerModal
          customerToEdit={editingCustomer}
          isOwner={isOwner}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}
