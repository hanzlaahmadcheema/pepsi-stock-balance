import { redirect } from "next/navigation";
import { cache } from "react";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { Role, hasRole } from "./roles";
import type { User as DbUser } from "@prisma/client";

export type { DbUser, SupabaseAuthUser };

/**
 * Retrieves the current authenticated user from Supabase Auth.
 * Uses getUser() to securely validate the JWT against Supabase servers.
 * Cached per request to eliminate redundant remote calls.
 */
export const getAuthUser = cache(async (): Promise<SupabaseAuthUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
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
