import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { QuarantineManager } from "./quarantine-manager";
import { getQuarantineRecordsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sync Quarantine Management | Admin",
  description: "Review and resolve deterministic sync blocks",
};

export default async function SyncQuarantinePage() {
  const user = await requireDbUser();

  const res = await getQuarantineRecordsAction();
  const initialRecords = res.records || [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sync Quarantine &amp; Block Management
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Deterministic cloud sync blocks are isolated here. Review payload anomalies, conflict policies, and resolve stream halts safely.
          </p>
        </div>

        <QuarantineManager initialRecords={initialRecords} />
      </main>
    </div>
  );
}
