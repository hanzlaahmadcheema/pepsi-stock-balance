"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BrandingConfig,
  setStoredBrandingConfig,
} from "@/lib/branding/branding-config";
import { saveBrandingAction, resetBrandingAction } from "./actions";
import { DeveloperCredit } from "@/components/ui/developer-credit";
import {
  IconCheck,
  IconAlertTriangle,
  IconRefresh,
  IconSettings,
  IconReceipt,
  IconPhone,
  IconMapPin,
  IconSparkles,
} from "@/components/ui/icons";

interface BrandingClientProps {
  initialConfig: BrandingConfig;
}

export function BrandingClient({ initialConfig }: BrandingClientProps) {
  const [config, setConfig] = useState<BrandingConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<{
    type: "idle" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  const handleSave = () => {
    startTransition(async () => {
      setSaveStatus({ type: "idle" });
      const res = await saveBrandingAction(config);
      if (res.success && res.config) {
        setConfig(res.config);
        setStoredBrandingConfig(res.config);
        setSaveStatus({
          type: "success",
          message: "Branding updated successfully! Active across header, receipts, and reports.",
        });
      } else {
        setSaveStatus({
          type: "error",
          message: res.error || "Failed to save branding configuration.",
        });
      }
    });
  };

  const handleReset = () => {
    if (!window.confirm("Reset business branding back to default system values?")) {
      return;
    }

    startTransition(async () => {
      const res = await resetBrandingAction();
      if (res.success && res.config) {
        setConfig(res.config);
        setStoredBrandingConfig(res.config);
        setSaveStatus({
          type: "success",
          message: "Branding reset to factory defaults.",
        });
      } else {
        setSaveStatus({
          type: "error",
          message: res.error || "Failed to reset branding.",
        });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Link href="/settings" className="hover:underline">
                Settings
              </Link>
              <span>/</span>
              <span>Branding &amp; Business Profile</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
              <IconSettings className="w-6 h-6 text-blue-600" />
              <span>Business Branding &amp; Identity</span>
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Define your depot business name, contact phone, email, and address.
              These settings appear across the app header, thermal receipts, and business reports.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleReset}
              disabled={isPending}
              className="px-3.5 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/40 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <IconCheck className="w-4 h-4" />
              <span>{isPending ? "Saving..." : "Save Branding"}</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {saveStatus.type !== "idle" && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-sm flex items-center gap-2.5 ${
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

      {/* Main Settings Form */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <IconSparkles className="w-4 h-4 text-blue-600" />
          <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Identity &amp; Contact Details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          {/* Business Name */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="font-bold text-zinc-800 dark:text-zinc-200">
              Business / Depot Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={config.businessName}
              onChange={(e) =>
                setConfig((p) => ({ ...p, businessName: e.target.value }))
              }
              placeholder="e.g. Pepsi Stock Balance"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold text-base focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Displayed on the top app header, invoice receipts, and exported reports.
            </p>
          </div>

          {/* Tagline / Subtitle */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="font-bold text-zinc-800 dark:text-zinc-200">
              Tagline / Subtitle
            </label>
            <input
              type="text"
              value={config.tagline}
              onChange={(e) =>
                setConfig((p) => ({ ...p, tagline: e.target.value }))
              }
              placeholder="e.g. Authorized Beverage Distribution Depot"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact Phone */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <IconPhone className="w-3.5 h-3.5 text-zinc-500" />
              <span>Contact Phone</span>
            </label>
            <input
              type="text"
              value={config.phone}
              onChange={(e) =>
                setConfig((p) => ({ ...p, phone: e.target.value }))
              }
              placeholder="e.g. 0300-1234567"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-800 dark:text-zinc-200">
              Contact Email
            </label>
            <input
              type="email"
              value={config.email}
              onChange={(e) =>
                setConfig((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="e.g. info@pepsidepot.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Depot Address */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <IconMapPin className="w-3.5 h-3.5 text-zinc-500" />
              <span>Depot Address / Location</span>
            </label>
            <input
              type="text"
              value={config.address}
              onChange={(e) =>
                setConfig((p) => ({ ...p, address: e.target.value }))
              }
              placeholder="e.g. Main Beverage Depot, Plot 42, Industrial Area, Lahore"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Tax NTN Number */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="font-bold text-zinc-800 dark:text-zinc-200">
              NTN / STRN Tax Registration Number
            </label>
            <input
              type="text"
              value={config.ntn}
              onChange={(e) =>
                setConfig((p) => ({ ...p, ntn: e.target.value }))
              }
              placeholder="e.g. NTN: 1234567-8 / STRN: 01-02-0304-005-19"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Quick link to receipt designer */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <IconReceipt className="w-4 h-4 text-blue-600" />
              <span>Receipt Layout Synchronized</span>
            </div>
            <p className="text-blue-700 dark:text-blue-300">
              Saving here automatically updates the business header on your 80mm SpeedX thermal invoices.
            </p>
          </div>
          <Link
            href="/settings/invoice-design"
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0 transition-colors shadow-xs"
          >
            Customize Invoice Sections →
          </Link>
        </div>
      </div>

      {/* Developer Credit Card */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
          Developer &amp; Support Credit
        </h3>
        <DeveloperCredit variant="card" />
      </div>
    </div>
  );
}
