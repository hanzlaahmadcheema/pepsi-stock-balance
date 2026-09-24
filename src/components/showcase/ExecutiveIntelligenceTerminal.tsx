"use client";

import React, { useState, useEffect } from "react";

export function ExecutiveIntelligenceTerminal() {
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"telemetry" | "ledger" | "fleet">("telemetry");
  const [reconciling, setReconciling] = useState(false);
  const [reconciledCount, setReconciledCount] = useState(14820);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleReconcile = () => {
    setReconciling(true);
    setTimeout(() => {
      setReconciledCount((prev) => prev + 120);
      setReconciling(false);
    }, 1200);
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#050507] text-[#EDEDED] font-sans antialiased selection:bg-blue-600/30 selection:text-blue-200 overflow-x-hidden">
      {/* 1. CINEMATIC BACKGROUND MESH (GPU-SAFE FIXED OVERLAY) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle Ambient Radial Glows */}
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-blue-600/15 via-indigo-600/5 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-[40%] -right-[15%] w-[600px] h-[600px] bg-cyan-500/10 blur-[160px] rounded-full" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[700px] h-[500px] bg-blue-700/10 blur-[180px] rounded-full" />
        {/* Micro-dot Matrix Texture */}
        <div 
          className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px]" 
        />
      </div>

      {/* 2. THE FLUID ISLAND NAV (DETACHED GLASS PILL) */}
      <header className="relative z-40 pt-6 px-4 sm:px-6">
        <nav className="mx-auto max-w-5xl rounded-full bg-[#0A0D14]/80 border border-white/[0.08] backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] px-4 py-2.5 flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
          {/* Brand & Telemetry Pulse */}
          <div className="flex items-center gap-3 pl-2">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/10 border border-blue-500/20">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
              <div className="absolute inset-0 rounded-full border border-blue-400/40 animate-ping opacity-50" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold tracking-tight text-white">PEPSI CO.</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">OS 2.4</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">DISTRIBUTION CLUSTER // LIVE</span>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-full border border-white/[0.05]">
            {(["telemetry", "ledger", "fleet"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all duration-300 capitalize ${
                  activeTab === tab
                    ? "bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Action CTA & Mobile Trigger */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handleReconcile}
              disabled={reconciling}
              className="group relative hidden sm:inline-flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-full bg-white text-zinc-950 font-medium text-xs tracking-tight shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.8)] hover:bg-zinc-100 active:scale-[0.98] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              <span>{reconciling ? "Syncing..." : "Sync Balance"}</span>
              <div className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <svg className="w-3 h-3 stroke-[1.25]" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                  <path d="M4 12L12 4M12 4H6M12 4V10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            {/* Hamburger Morph Trigger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle Menu"
              className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.1] active:scale-95 transition-all md:hidden"
            >
              <div className="relative w-4 h-3 flex flex-col justify-between">
                <span className={`block h-[1.5px] w-full bg-current rounded transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-[5px]" : ""}`} />
                <span className={`block h-[1.5px] w-full bg-current rounded transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
                <span className={`block h-[1.5px] w-full bg-current rounded transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-[5px]" : ""}`} />
              </div>
            </button>
          </div>
        </nav>

        {/* Hamburger Modal Expansion */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-3xl p-6 flex flex-col justify-between md:hidden animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono tracking-widest text-zinc-400">NAVIGATION OVERLAY</span>
              <button 
                onClick={() => setMenuOpen(false)}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-6 py-12">
              {["Live Telemetry", "Customer Balances", "Container Matrix", "Reconciliation Radar", "Settings"].map((label, idx) => (
                <button
                  key={label}
                  onClick={() => setMenuOpen(false)}
                  style={{ animationDelay: `${idx * 60}ms` }}
                  className="text-2xl font-light tracking-tight text-left text-zinc-300 hover:text-white transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 pt-4 text-xs font-mono text-zinc-500">
              TERMINAL ID: PEPSI-CORP-PK-884
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO & METRIC ORCHESTRATION (SPATIAL RHYTHM) */}
      <main className="relative z-10 mx-auto max-w-[1720px] w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-16 sm:py-24 lg:py-28">
        
        {/* Eyebrow Pill */}
        <div className="flex items-center gap-2 mb-6">
          <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[11px] font-mono tracking-[0.2em] uppercase bg-blue-500/[0.08] text-blue-400 border border-blue-500/25 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            ENTERPRISE LOGISTICS INTELLIGENCE
          </div>
          <span className="hidden sm:inline-block text-xs font-mono text-zinc-600">// CLOUD SYNCHRONIZED</span>
        </div>

        {/* Master Asymmetric Headline Lockup */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end mb-16 sm:mb-20">
          <div className="lg:col-span-8">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]">
              Every Crate. Every Cent.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300">
                Authoritatively Locked.
              </span>
            </h1>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md">
              High-throughput beverage inventory engine engineered for cashiers, logistics controllers, and enterprise leadership. Eliminating crate leakage and settlement drift.
            </p>

            {/* Nested Doppelrand Mini Summary */}
            <div className="bg-white/[0.02] border border-white/[0.06] p-1.5 rounded-2xl shadow-xl">
              <div className="bg-[#0D1017] border border-white/[0.04] p-4 rounded-[calc(1rem-0.125rem)] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">NET LIQUIDITY IN HAND</div>
                  <div className="text-xl font-bold font-mono tracking-tight text-white">Rs. 842,500.00</div>
                </div>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  100% RECONCILED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. THE ASYMMETRICAL DOPPELRAND BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* BENTO CARD 1: REAL-TIME CRATE VELOCITY (SPAN 8) */}
          <div className="md:col-span-12 lg:col-span-8 group relative bg-white/[0.03] border border-white/[0.08] p-2 rounded-[2rem] shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/[0.14]">
            <div className="h-full bg-[#0B0E17]/90 border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] rounded-[calc(2rem-0.5rem)] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                {/* Header Meta */}
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-5 mb-6">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-400">CORE INVENTORY VELOCITY</span>
                    <h3 className="text-xl font-semibold tracking-tight text-white mt-0.5">Physical Stock & Throughput</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      4 ACTIVE DEPOTS
                    </span>
                  </div>
                </div>

                {/* Big Metric Display */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
                    <span className="text-[10px] font-mono uppercase text-zinc-500">WAREHOUSE ON-HAND</span>
                    <div className="text-3xl font-bold font-mono text-white mt-1">
                      {reconciledCount.toLocaleString()} <span className="text-sm font-sans font-normal text-zinc-500">crates</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 mt-1">
                      ↑ 4.2% since morning dispatch
                    </span>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
                    <span className="text-[10px] font-mono uppercase text-zinc-500">DISPATCHED IN TRANSIT</span>
                    <div className="text-3xl font-bold font-mono text-white mt-1">
                      3,420 <span className="text-sm font-sans font-normal text-zinc-500">crates</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 mt-1">
                      18 route manifests active
                    </span>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
                    <span className="text-[10px] font-mono uppercase text-zinc-500">QUARANTINED / DAMAGED</span>
                    <div className="text-3xl font-bold font-mono text-amber-400 mt-1">
                      42 <span className="text-sm font-sans font-normal text-zinc-500">bottles</span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-500/90 flex items-center gap-1 mt-1">
                      Owner inspection pending
                    </span>
                  </div>
                </div>

                {/* Simulated Stock Telemetry Graph Bars */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>SKU BREAKDOWN (CRATES)</span>
                    <span>CAPACITY UTILIZATION: 78%</span>
                  </div>
                  {[
                    { name: "Pepsi Cola 500ml (24x)", count: 6240, percent: "85%", color: "bg-blue-500" },
                    { name: "Mountain Dew 1.5L (6x)", count: 4120, percent: "65%", color: "bg-emerald-500" },
                    { name: "7UP Refresh 250ml Can", count: 2890, percent: "45%", color: "bg-cyan-400" },
                    { name: "Mirinda Orange 300ml Glass", count: 1570, percent: "30%", color: "bg-amber-500" },
                  ].map((sku) => (
                    <div key={sku.name} className="flex flex-col gap-1.5 bg-black/30 p-3 rounded-lg border border-white/[0.03]">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-300 font-medium">{sku.name}</span>
                        <span className="font-mono text-zinc-400">{sku.count.toLocaleString()} crates</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className={`h-full ${sku.color} rounded-full`} style={{ width: sku.percent }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer Button */}
              <div className="mt-8 pt-4 border-t border-white/[0.05] flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-500">IMMUTABLE LEDGER RECORD: #SM-2026-9810</span>
                <button className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                  View Full Movement Journal →
                </button>
              </div>
            </div>
          </div>

          {/* BENTO CARD 2: SETTLE-VAULT & CASH RECONCILIATION (SPAN 4) */}
          <div className="md:col-span-12 lg:col-span-4 group relative bg-white/[0.03] border border-white/[0.08] p-2 rounded-[2rem] shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/[0.14]">
            <div className="h-full bg-[#0B0E17]/90 border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] rounded-[calc(2rem-0.5rem)] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-5 mb-6">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400">RECONCILIATION</span>
                    <h3 className="text-xl font-semibold tracking-tight text-white mt-0.5">Settle-Vault</h3>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <svg className="w-4 h-4 stroke-[1.25]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                </div>

                {/* Visual Balance Gauge */}
                <div className="bg-gradient-to-br from-blue-950/40 via-black/40 to-transparent p-5 rounded-2xl border border-white/[0.06] mb-6">
                  <span className="text-[10px] font-mono uppercase text-zinc-400">DAILY DRAWER NET CASH</span>
                  <div className="text-3xl font-bold font-mono text-white tracking-tight mt-1">
                    Rs. 248,350
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Cash Collected</span>
                      <span className="font-mono text-zinc-300">Rs. 182,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Bank / EasyPaisa</span>
                      <span className="font-mono text-zinc-300">Rs. 66,350</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Discrepancy</span>
                      <span className="font-mono text-emerald-400">Rs. 0.00 (Zero Drift)</span>
                    </div>
                  </div>
                </div>

                {/* Customer Credit Exposure Indicator */}
                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Customer Credit Due</span>
                    <span className="font-mono text-amber-400 font-semibold">Rs. 112,400</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 leading-normal">
                    24 registered retail distributors have open accounts. Zero unauthorized balances.
                  </div>
                </div>
              </div>

              {/* Nested Action CTA */}
              <div className="mt-8 pt-4 border-t border-white/[0.05]">
                <button className="group w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs tracking-tight shadow-[0_1px_10px_rgba(37,99,235,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-[0.98] transition-all duration-300 flex items-center justify-between">
                  <span>Execute Day-End Closing</span>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    →
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* BENTO CARD 3: CONTAINER CIRCULATION MATRIX (SPAN 4) */}
          <div className="md:col-span-12 lg:col-span-4 group relative bg-white/[0.03] border border-white/[0.08] p-2 rounded-[2rem] shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/[0.14]">
            <div className="h-full bg-[#0B0E17]/90 border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] rounded-[calc(2rem-0.5rem)] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-5 mb-6">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-indigo-400">REUSABLE ASSETS</span>
                    <h3 className="text-xl font-semibold tracking-tight text-white mt-0.5">Containers Due</h3>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <svg className="w-4 h-4 stroke-[1.25]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.05]">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-medium text-zinc-300">Plastic Crates Owed</span>
                      <span className="text-xl font-bold font-mono text-white">4,812</span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500">
                      Dispatched: 6,100 | Returned: 1,288
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.05]">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-medium text-zinc-300">Glass Bottles Owed</span>
                      <span className="text-xl font-bold font-mono text-white">32,490</span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500">
                      Dispatched: 38,000 | Returned: 5,510
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/[0.05] flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>RECOVERY RATE: 89.4%</span>
                <span className="text-emerald-400">HEALTHY</span>
              </div>
            </div>
          </div>

          {/* BENTO CARD 4: LIVE DISPATCH RADAR & VERIFICATION STREAM (SPAN 8) */}
          <div className="md:col-span-12 lg:col-span-8 group relative bg-white/[0.03] border border-white/[0.08] p-2 rounded-[2rem] shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/[0.14]">
            <div className="h-full bg-[#0B0E17]/90 border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] rounded-[calc(2rem-0.5rem)] p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-5 mb-6">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">AUDIT TRAIL // REAL-TIME</span>
                    <h3 className="text-xl font-semibold tracking-tight text-white mt-0.5">Live Operational Stream</h3>
                  </div>
                  <span className="text-xs font-mono text-zinc-500">FILTER: ALL TRANSACTIONS</span>
                </div>

                <div className="divide-y divide-white/[0.04] text-xs font-mono">
                  {[
                    { action: "INVOICE CREATED", id: "INV-20260908-9193", details: "Al-Madina Mart — 10 Crates (Credit Rs. 3,000)", time: "18:04:12", status: "VERIFIED" },
                    { action: "RECEIVING POSTED", id: "REC-20260908-0041", details: "Pepsi Multan Plant — 100 Crates Accepted", time: "17:32:00", status: "LOCKED" },
                    { action: "RETURN RESTOCKED", id: "RET-20260908-7718", details: "Gulberg Superstore — 6 Crates Approved into Stock", time: "16:45:19", status: "RESTOCKED" },
                    { action: "DAILY COUNT AUDIT", id: "COUNT-20260908-01", details: "Staff Inventory Count Submitted (Zero Discrepancy)", time: "15:20:04", status: "CLOSED" },
                  ].map((evt) => (
                    <div key={evt.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-semibold">{evt.action}</span>
                        <span className="text-zinc-300 font-sans text-xs">{evt.details}</span>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <span className="text-zinc-500">{evt.time}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {evt.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/[0.05] flex items-center justify-between text-xs font-mono text-zinc-500">
                <span>CRYPTOGRAPHIC AUDIT CHAIN VALIDATED</span>
                <span className="text-zinc-400">HASH: 7f8a92b...e3</span>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* 5. CINEMATIC FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-black/40 py-12 px-4 sm:px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-[1720px] w-full px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">PEPSI STOCK BALANCE</span>
            <span>//</span>
            <span className="font-mono">VANGUARD OPERATING SYSTEM</span>
          </div>
          <div className="font-mono text-zinc-600">
            ENGINEERED WITH HAPTIC ARCHITECTURE & ZERO-DRIFT RECONCILIATION
          </div>
        </div>
      </footer>
    </div>
  );
}
export default ExecutiveIntelligenceTerminal;
