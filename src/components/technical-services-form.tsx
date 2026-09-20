"use client";

import React, { useState } from "react";
import { IconWhatsApp, IconCheck, IconAlertTriangle } from "@/components/ui/icons";

interface TechnicalServicesFormProps {
  onSuccess?: () => void;
  className?: string;
  defaultServiceType?: string;
}

const SERVICE_OPTIONS = [
  "General Technical Support",
  "Depot Server & Windows Setup",
  "PostgreSQL Database & Offline Sync",
  "Custom Feature / Business Report Request",
  "Hardware, Barcode & Thermal Printer Setup",
  "Urgent System Downtime / Disaster Recovery",
  "Other Technical Services",
];

export function TechnicalServicesForm({
  onSuccess,
  className = "",
  defaultServiceType = "General Technical Support",
}: TechnicalServicesFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    serviceType: defaultServiceType,
    message: "",
  });

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        "Hello! I need technical services for the Pepsi Stock Balance system."
      )}`
    : `https://wa.me/?text=${encodeURIComponent(
        "Hello! I need technical services for the Pepsi Stock Balance system."
      )}`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: "d3b0e7cb-65dc-47d4-ad29-4eb83fbbc3d9",
          subject: `Technical Services Request: ${formData.serviceType} - ${formData.name}`,
          from_name: "Pepsi Stock Balance Portal",
          name: formData.name,
          email: formData.email,
          phone: formData.phone || "Not provided",
          service_type: formData.serviceType,
          message: formData.message,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus("success");
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setStatus("error");
        setErrorMessage(data.message || "Failed to submit form. Please try again or message on WhatsApp.");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Network error. Please check your connection or reach out via WhatsApp.");
    }
  }

  function handleReset() {
    setFormData({
      name: "",
      email: "",
      phone: "",
      serviceType: defaultServiceType,
      message: "",
    });
    setStatus("idle");
    setErrorMessage("");
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* WhatsApp Quick Action Banner */}
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 dark:border-emerald-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-500/20">
              <IconWhatsApp className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Message on WhatsApp
              </h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Direct chat with our technical engineering team for instant support
              </p>
            </div>
          </div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow-emerald-600/25 shrink-0"
          >
            <IconWhatsApp className="w-4 h-4" />
            <span>Chat on WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Or Divider */}
      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
        <span className="absolute bg-white dark:bg-zinc-900 px-3 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Or Fill The Service Form
        </span>
      </div>

      {/* Success State */}
      {status === "success" ? (
        <div className="rounded-2xl p-6 sm:p-8 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <IconCheck className="w-6 h-6 stroke-[3]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Technical Request Received!
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 max-w-md mx-auto">
              Thank you for contacting us. Your technical services inquiry has been submitted. Our engineering team will review it and get in touch with you promptly.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs sm:text-sm font-medium rounded-xl text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            >
              Submit Another Request
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition"
            >
              <IconWhatsApp className="w-4 h-4" />
              Follow up on WhatsApp
            </a>
          </div>
        </div>
      ) : (
        /* Form State */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot for spam bots */}
          <input type="checkbox" name="botcheck" className="hidden" style={{ display: "none" }} />

          {/* Error Banner */}
          {status === "error" && (
            <div className="rounded-xl p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3 text-red-800 dark:text-red-200 text-xs sm:text-sm">
              <IconAlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold">Submission Error</p>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Name & Email Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tech-name"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                id="tech-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Bilawal / Depot Admin"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label
                htmlFor="tech-email"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="tech-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your.email@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
              />
            </div>
          </div>

          {/* Phone & Service Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tech-phone"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                WhatsApp / Phone Number
              </label>
              <input
                id="tech-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +92 300 1234567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
              />
            </div>

            <div>
              <label
                htmlFor="tech-service-type"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Service Category <span className="text-red-500">*</span>
              </label>
              <select
                id="tech-service-type"
                required
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              >
                {SERVICE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Message Area */}
          <div>
            <label
              htmlFor="tech-message"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Description of Technical Service Needed <span className="text-red-500">*</span>
            </label>
            <textarea
              id="tech-message"
              rows={4}
              required
              minLength={10}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Please provide details about the technical service, error message, hardware setup, or feature you require..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-sm shadow-sm hover:shadow-blue-600/25 transition cursor-pointer disabled:cursor-not-allowed"
            >
              {status === "submitting" ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Submitting Request...</span>
                </>
              ) : (
                <span>Submit Technical Services Request</span>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-zinc-600 dark:text-zinc-400 pt-1">
            Protected by Web3Forms. Your details will only be used to respond to your technical request.
          </p>
        </form>
      )}
    </div>
  );
}
