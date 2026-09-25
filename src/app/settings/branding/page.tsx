import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { getBrandingConfig } from "@/lib/branding/branding-service";
import { BrandingClient } from "./branding-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Business Branding - Pepsi Stock Balance",
  description:
    "Customize business identity, contact phone, email, and address across the application.",
};

export default async function BrandingPage() {
  const user = await requireDbUser();
  const initialConfig = await getBrandingConfig();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <BrandingClient initialConfig={initialConfig} />
      </main>
    </div>
  );
}
