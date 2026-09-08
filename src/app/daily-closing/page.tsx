import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import {
  getTodayBusinessDateString,
  getDailyClosingSummary,
  listDailyClosings,
} from "@/lib/daily-closing/service";
import { DailyClosingClient } from "./daily-closing-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Daily Closing - Pepsi Stock Balance",
};

export default async function DailyClosingPage() {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const todayDateStr = getTodayBusinessDateString();
  const todaySummary = await getDailyClosingSummary(todayDateStr);
  const recentClosings = await listDailyClosings(60);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DailyClosingClient
          todaySummary={todaySummary}
          recentClosings={recentClosings}
          isOwner={isOwner}
          todayDateStr={todayDateStr}
        />
      </main>
    </div>
  );
}
