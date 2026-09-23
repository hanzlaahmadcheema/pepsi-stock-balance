import { redirect } from "next/navigation";
import { cache } from "react";
import { cookies } from "next/headers";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Role, hasRole } from "./roles";
import {
  LOCAL_SESSION_COOKIE,
  verifyLocalSession,
  extractUserFromSupabaseCookies,
} from "./session";
import type { User as DbUser } from "@prisma/client";

export type { DbUser, SupabaseAuthUser };

/**
 * Retrieves the current authenticated user from local session cookie or Supabase Auth.
 * 100% resilient offline fallback ensures local depot operations are never blocked.
 * Cached per request to eliminate redundant remote calls.
 */
export const getAuthUser = cache(async (): Promise<SupabaseAuthUser | null> => {
  const cookieStore = await cookies();

  // 1. Direct local session cookie check (0ms latency, 100% offline-ready)
  const localCookie = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  if (localCookie) {
    const session = await verifyLocalSession(localCookie);
    if (session) {
      return {
        id: session.authUserId,
        email: session.email || `${session.name.toLowerCase().replace(/\s+/g, "")}@pepsidepot.local`,
        user_metadata: { name: session.name, role: session.role },
        app_metadata: { role: session.role },
        aud: "authenticated",
        created_at: new Date(session.createdAt).toISOString(),
      } as SupabaseAuthUser;
    }
  }

  // 2. Extract from existing Supabase auth cookies (offline fallback)
  const allCookies = cookieStore.getAll();
  const extracted = extractUserFromSupabaseCookies(allCookies);
  if (extracted) {
    return {
      id: extracted.id,
      email: extracted.email || "user@pepsidepot.local",
      user_metadata: extracted.user_metadata || {},
      app_metadata: { role: extracted.role },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as SupabaseAuthUser;
  }

  // 3. Fallback: Query Supabase Auth server with fast timeout
  try {
    const supabase = await createClient();
    const res = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase auth timeout")), 1500)
      ),
    ]);

    if (!res.error && res.data?.user) {
      return res.data.user;
    }
  } catch {
    // Remote auth server unreachable (offline depot PC)
  }

  return null;
});

/**
 * Retrieves the database user record associated with the current Supabase auth session
 * via the `authUserId` unique relation.
 * Cached per request to eliminate duplicate DB lookups across layout and page.
 */
export const getCurrentDbUser = cache(async (): Promise<DbUser | null> => {
  const authUser = await getAuthUser();
  if (!authUser) {
    return null;
  }

  let dbUser = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
  });

  // If there are no users registered in the database, bootstrap the first authenticated user as OWNER
  if (!dbUser) {
    const totalUsers = await prisma.user.count();
    if (totalUsers === 0) {
      dbUser = await prisma.user.create({
        data: {
          authUserId: authUser.id,
          name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Owner",
          role: Role.OWNER,
          isActive: true,
        },
      });
    }
  }

  return dbUser;
});


/**
 * Ensures the request is authenticated via Supabase.
 * If not authenticated, redirects to the login route.
 */
export async function requireAuthUser(redirectTo = "/login"): Promise<SupabaseAuthUser> {
  const authUser = await getAuthUser();
  if (!authUser) {
    redirect(redirectTo);
  }
  return authUser;
}

/**
 * Ensures the request is authenticated and has an active database User record.
 * If not authenticated or user is inactive/not found, redirects accordingly.
 */
export async function requireDbUser(redirectTo = "/login"): Promise<DbUser> {
  const dbUser = await getCurrentDbUser();
  if (!dbUser || !dbUser.isActive) {
    redirect(redirectTo);
  }
  return dbUser;
}

/**
 * Ensures the authenticated user has one of the required roles.
 * If unauthorized, redirects to /unauthorized or the specified path.
 */
export async function requireRole(
  allowedRoles: Role | Role[],
  unauthorizedRedirect = "/unauthorized"
): Promise<DbUser> {
  const dbUser = await requireDbUser();

  if (!hasRole(dbUser.role, allowedRoles)) {
    redirect(unauthorizedRedirect);
  }

  return dbUser;
}

/**
 * Helper to link or synchronize a Supabase Auth user with the application Prisma User table.
 */
export async function linkAuthUserToDbUser(params: {
  authUserId: string;
  name: string;
  role?: Role;
  pinHash?: string | null;
}): Promise<DbUser> {
  return prisma.user.upsert({
    where: { authUserId: params.authUserId },
    update: {
      name: params.name,
      ...(params.role && { role: params.role }),
      ...(params.pinHash !== undefined && { pinHash: params.pinHash }),
    },
    create: {
      authUserId: params.authUserId,
      name: params.name,
      role: params.role ?? Role.STAFF,
      pinHash: params.pinHash ?? null,
      isActive: true,
    },
  });
}
