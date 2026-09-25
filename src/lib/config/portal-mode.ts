/**
 * Portal Mode Configuration
 * 
 * Determines whether the current application is operating in:
 * - Local Windows Depot mode: Full operational transactional POS, stock mutations, daily closings.
 * - Cloud Production portal mode: Strictly READ-ONLY management, reporting, and intelligence portal.
 */

export function isCloudPortal(): boolean {
  if (typeof window !== "undefined") {
    // Client-side detection via Next.js statically inlined or runtime env
    return (
      process.env.NEXT_PUBLIC_IS_CLOUD === "true" ||
      process.env.NEXT_PUBLIC_APP_ENV === "CLOUD_PROD" ||
      process.env.NEXT_PUBLIC_APP_ENV === "CLOUD_DEV" ||
      process.env.NEXT_PUBLIC_APP_ENV === "CLOUD" ||
      Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV)
    );
  }

  // Server-side detection
  const env = (process.env.APP_ENV || "").toUpperCase();
  if (env === "CLOUD_PROD" || env === "CLOUD_DEV" || env === "CLOUD") return true;
  if (process.env.IS_CLOUD === "true" || process.env.NEXT_PUBLIC_IS_CLOUD === "true") return true;
  if (Boolean(process.env.VERCEL)) return true;

  return false;
}

/**
 * Guard to prevent operational mutations on Cloud portal.
 * Throws an explicit, descriptive Error if invoked when running in Cloud mode.
 */
export function assertNotCloudPortal(operationName: string): void {
  if (isCloudPortal()) {
    throw new Error(
      `Operational record mutation (${operationName}) is strictly prohibited on Cloud Production portal. All business operational entries (sales, receivings, damages, stock counts, closings, settings) must be executed on the Windows Depot terminal.`
    );
  }
}
