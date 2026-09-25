import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { isCloudPortal } from "@/lib/config/portal-mode";
import { getCustomerDetails } from "@/lib/customers/service";
import { CustomerPaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";

interface CustomerPaymentsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: CustomerPaymentsPageProps) {
  const { id } = await params;
  const customer = await getCustomerDetails(id);
  return {
    title: customer ? `Record Payment - ${customer.name}` : "Record Customer Payment",
  };
}

export default async function CustomerPaymentsPage({ params }: CustomerPaymentsPageProps) {
  const { id } = await params;
  if (isCloudPortal()) {
    redirect(`/customers/${id}`);
  }
  const user = await requireDbUser();
  const customer = await getCustomerDetails(id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 space-y-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/customers/${customer.id}`} className="hover:underline">
            ← Back to {customer.name}&apos;s Ledger
          </Link>
        </div>

        <CustomerPaymentForm
          customerId={customer.id}
          customerName={customer.name}
          outstandingBalance={customer.outstandingBalance}
        />
      </main>
    </div>
  );
}
