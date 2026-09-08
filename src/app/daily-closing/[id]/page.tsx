import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getDailyClosingById } from "@/lib/daily-closing/service";
import { DailyClosingDetailsClient } from "./daily-closing-details-client";

export const dynamic = "force-dynamic";

interface DailyClosingDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: DailyClosingDetailsPageProps) {
  const { id } = await params;
  return {
    title: `Daily Closing #${id.slice(0, 8)} - Pepsi Stock Balance`,
  };
}

export default async function DailyClosingDetailsPage({
  params,
}: DailyClosingDetailsPageProps) {
  const { id } = await params;
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const summary = await getDailyClosingById(id);

  if (!summary) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DailyClosingDetailsClient
          summary={summary}
          isOwner={isOwner}
          currentUserId={user.id}
        />
      </main>
    </div>
  );
}
