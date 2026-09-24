import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getSystemVersionInfo } from "@/lib/version/service";
import { SystemUpdateClient } from "./system-update-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Updates & Version Control - Pepsi Stock Balance",
  description: "Scan GitHub repository for updates and pull latest commits directly from the web interface.",
};

export default async function SystemUpdatePage() {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const initialVersion = await getSystemVersionInfo(false);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        <SystemUpdateClient initialData={initialVersion} isOwner={isOwner} />
      </main>
    </div>
  );
}
