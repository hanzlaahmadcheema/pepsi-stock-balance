import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { listCustomers } from "@/lib/customers/service";
import { CustomerListWrapper } from "./customer-modal";

export const dynamic = "force-dynamic";

interface CustomersPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const { q } = await searchParams;

  const customers = await listCustomers(q);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <CustomerListWrapper customers={customers} isOwner={isOwner} />
      </main>
    </div>
  );
}
