import Link from "next/link";
import { getCurrentDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { TechnicalServicesForm } from "@/components/technical-services-form";
import { IconLifebuoy, IconArrowLeft, IconShield, IconTruck, IconServer } from "@/components/ui/icons";

export const metadata = {
  title: "Technical Services & Support - Pepsi Stock Balance",
  description: "Request technical services, depot server setup, sync troubleshooting, or message on WhatsApp.",
};

export default async function TechnicalServicesPage() {
  const user = await getCurrentDbUser();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {user ? (
        <AppHeader user={user} />
      ) : (
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                P
              </div>
              <div>
                <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Pepsi Stock Balance
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Technical Support & Engineering Services
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <IconArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </header>
      )}

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 sm:py-12">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 mb-4">
            <IconLifebuoy className="w-3.5 h-3.5" />
            <span>Engineering & Operational Support</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Need Any Technical Services?
          </h1>
          <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
            Fill the service request form below or message our engineering team directly on WhatsApp for prompt depot, server, or software assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Form Container */}
          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Submit Service Request
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              Inquiries are dispatched directly to our technical operations queue via Web3Forms.
            </p>
            <TechnicalServicesForm />
          </div>

          {/* Support Capabilities Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Supported Technical Services
              </h3>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <IconServer className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Windows Depot Deployment
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      PostgreSQL 18 setup, NSSM background services, and LAN firewall hardening.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <IconShield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Sync & Database Recovery
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Cloud-to-depot sync diagnostics, quarantine resolution, and automated backups.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <IconTruck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Custom Ledger & Reports
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Regional office customizations, tax invoices, and specialized export formats.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                Operating Depot Hours
              </p>
              <p>Monday – Saturday: 8:00 AM – 8:00 PM PKT</p>
              <p>Emergency system recovery monitored 24/7 on WhatsApp.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
