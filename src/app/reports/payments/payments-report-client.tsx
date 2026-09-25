"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PaymentReportResult } from "@/lib/reports/service";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { PaymentMethod } from "@prisma/client";
import {
  IconDownload,
  IconFileSpreadsheet,
  IconDollarSign,
  IconBanknotes,
  IconDeviceMobile,
  IconReceipt,
} from "@/components/ui/icons";

interface PaymentsReportClientProps {
  data: PaymentReportResult;
  staffUsers: { id: string; name: string }[];
  filters: {
    startDate: string;
    endDate: string;
    paymentMethod: string;
    type: string;
    receivedById: string;
    page: number;
  };
}

export function PaymentsReportClient({
  data,
  staffUsers,
  filters,
}: PaymentsReportClientProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [paymentMethod, setPaymentMethod] = useState(filters.paymentMethod);
  const [type, setType] = useState(filters.type);
  const [receivedById, setReceivedById] = useState(filters.receivedById);

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (paymentMethod) q.set("paymentMethod", paymentMethod);
    if (type && type !== "all") q.set("type", type);
    if (receivedById) q.set("receivedById", receivedById);
    q.set("page", "1");
    router.push(`/reports/payments?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (paymentMethod) q.set("paymentMethod", paymentMethod);
    if (type && type !== "all") q.set("type", type);
    if (receivedById) q.set("receivedById", receivedById);
    q.set("page", newPage.toString());
    router.push(`/reports/payments?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=payments&startDate=${startDate}&endDate=${endDate}&paymentMethod=${paymentMethod}&type=${type}&receivedById=${receivedById}`;

  const { summary } = data;
  const mobileDigitalAmount =
    (summary.byMethod.EASYPAISA?.amount || 0) +
    (summary.byMethod.JAZZCASH?.amount || 0) +
    (summary.byMethod.MPESA?.amount || 0) +
    (summary.byMethod.QR?.amount || 0);

  const mobileDigitalCount =
    (summary.byMethod.EASYPAISA?.count || 0) +
    (summary.byMethod.JAZZCASH?.count || 0) +
    (summary.byMethod.MPESA?.count || 0) +
    (summary.byMethod.QR?.count || 0);

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Cash & Payment Collections Report</span>
      </div>

      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            Cash & Payment Collections Report
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Audit cash registers, mobile wallets (EasyPaisa, JazzCash), counter receipts, and customer account settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${exportUrl}&format=csv`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-xs transition-colors"
          >
            <IconDownload className="w-3.5 h-3.5" />
            <span>CSV</span>
          </a>
          <a
            href={`${exportUrl}&format=xlsx`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <IconFileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Total Collections
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IconDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            {formatCurrency(summary.totalAmount)}
          </div>
          <div className="text-xs text-zinc-500">
            Across <strong>{summary.count}</strong> transactions
          </div>
        </div>

        {/* Physical Cash */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-900/40 shadow-xs space-y-2 bg-emerald-50/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Cash Drawer
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconBanknotes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.byMethod.CASH?.amount || 0)}
          </div>
          <div className="text-xs text-zinc-500">
            {summary.byMethod.CASH?.count || 0} cash payments
          </div>
        </div>

        {/* Digital & Mobile */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-indigo-200 dark:border-indigo-900/40 shadow-xs space-y-2 bg-indigo-50/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Digital &amp; Mobile
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <IconDeviceMobile className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {formatCurrency(mobileDigitalAmount)}
          </div>
          <div className="text-xs text-zinc-500">
            {mobileDigitalCount} mobile wallet / QR entries
          </div>
        </div>

        {/* Counter vs Debt Split */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Channel Split
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <IconReceipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xs space-y-1 pt-1">
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 dark:text-zinc-400">Counter Sales:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                {formatCurrency(summary.counterAmount)}
              </strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 dark:text-zinc-400">Account Debt:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                {formatCurrency(summary.accountAmount)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleFilter}
        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
            Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            <option value="">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="EASYPAISA">EasyPaisa</option>
            <option value="JAZZCASH">JazzCash</option>
            <option value="MPESA">M-Pesa</option>
            <option value="QR">QR Code</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
            Payment Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Types</option>
            <option value="counter">Counter Sale Only</option>
            <option value="account">Account Debt Settlement</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
            Received By
          </label>
          <select
            value={receivedById}
            onChange={(e) => setReceivedById(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            <option value="">All Staff</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full text-xs font-bold py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Payments Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Invoice / Ref #</th>
                <th className="py-3 px-4">Collector</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No payment records found for the selected period.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                      {formatDateTime(row.paidAt)}
                    </td>
                    <td className="py-3 px-4">
                      {row.type === "COUNTER_SALE" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                          Counter Sale
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                          Account Debt
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold">
                        {row.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {row.customerName ? (
                        <Link
                          href={`/customers/${row.customerId}`}
                          className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 transition-colors"
                        >
                          {row.customerName}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">Over-the-Counter</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {row.invoiceNumber ? (
                        <Link
                          href={`/sales/${row.saleId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {row.invoiceNumber}
                        </Link>
                      ) : row.referenceNumber ? (
                        <span className="text-zinc-500">Ref: {row.referenceNumber}</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                      {row.receivedByName}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="py-3 px-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <div>
            Showing Page <strong>{data.pagination.page}</strong> of{" "}
            <strong>{data.pagination.totalPages}</strong> (
            <strong>{data.pagination.totalRows}</strong> records)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.pagination.page <= 1}
              onClick={() => handlePageChange(data.pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => handlePageChange(data.pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
