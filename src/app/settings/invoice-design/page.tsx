import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { getReceiptDesignConfig } from "@/lib/receipt/design-service";
import { InvoiceDesignClient } from "./invoice-design-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoice Design - Pepsi Stock Balance",
  description:
    "Design and customize 80mm thermal receipts, depot branding, customer details, and section layout.",
};

export default async function InvoiceDesignPage() {
  const user = await requireDbUser();
  const initialConfig = await getReceiptDesignConfig();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <div className="print:hidden">
        <AppHeader user={user} />
      </div>

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <InvoiceDesignClient initialConfig={initialConfig} />
      </main>
    </div>
  );
}
