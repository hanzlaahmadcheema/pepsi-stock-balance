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
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader user={user} />

      <main className="mx-auto w-full max-w-[1720px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
        <CustomerListWrapper customers={customers} isOwner={isOwner} />
      </main>
    </div>
  );
}
