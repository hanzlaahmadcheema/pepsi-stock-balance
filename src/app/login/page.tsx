import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign In - Pepsi Stock Balance",
  description: "Sign in to access your distribution system",
};

interface LoginPageProps {
  searchParams: Promise<{
    redirectTo?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = params.redirectTo || "/";
  const initialError =
    params.error === "auth_callback_failed"
      ? "Authentication callback failed. Please try signing in again."
      : undefined;

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-xl mb-4 shadow-sm">
          P
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pepsi Stock Balance
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to your authorized account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 shadow-sm sm:rounded-xl sm:px-10 border border-zinc-200 dark:border-zinc-800">
          <LoginForm redirectTo={redirectTo} initialError={initialError} />
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/technical-services"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition"
          >
            <span>Need technical services or setup help?</span>
            <span className="underline font-semibold">Contact Support or WhatsApp</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
