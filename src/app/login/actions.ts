"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import {
  LOCAL_SESSION_COOKIE,
  signLocalSession,
} from "@/lib/auth/session";
import {
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const identifier = ((formData.get("identifier") || formData.get("email")) as string)?.trim();
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/";

  if (!identifier || !password) {
    return { error: "Username or email and password are required." };
  }

  // Resolve identifier to an email address for Supabase Auth
  let resolvedEmail = identifier;

  if (!identifier.includes("@")) {
    const normalizedUsername = identifier.toLowerCase().replace(/\s+/g, "");

    // 1. Try finding a registered User by matching name (case-insensitive)
    try {
      const dbUser = await prisma.user.findFirst({
        where: {
          name: { equals: identifier, mode: "insensitive" },
        },
      });

      if (dbUser) {
        // Query Supabase Admin to fetch their actual registered auth email
        try {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const adminClient = createAdminClient();
          const { data: authUserResult } = await adminClient.auth.admin.getUserById(dbUser.authUserId);
          if (authUserResult?.user?.email) {
            resolvedEmail = authUserResult.user.email;
          }
        } catch {
          // If admin lookup fails, continue with fallback
        }
      }
    } catch {
      // If Prisma query fails, continue with fallback
    }

    // 2. Default to internal depot alias domain if not resolved
    if (!resolvedEmail.includes("@")) {
      resolvedEmail = `${normalizedUsername}@pepsidepot.local`;
    }
  }

  let authUserId: string | null = null;
  let isNetworkError = false;

  try {
    const supabase = await createClient();
    const result = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    if (!result.error && result.data?.user) {
      authUserId = result.data.user.id;
    } else if (result.error) {
      const msg = result.error.message?.toLowerCase() || "";
      if (
        msg.includes("fetch failed") ||
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("failed to fetch") ||
        result.error.status === 0
      ) {
        isNetworkError = true;
      } else {
        // Check secondary alias fallback before giving up
        if (!identifier.includes("@")) {
          const aliasEmail = `${identifier.toLowerCase().replace(/\s+/g, "")}@pepsidepot.local`;
          if (aliasEmail !== resolvedEmail) {
            const fallbackResult = await supabase.auth.signInWithPassword({
              email: aliasEmail,
              password,
            });
            if (!fallbackResult.error && fallbackResult.data.user) {
              authUserId = fallbackResult.data.user.id;
            } else if (fallbackResult.error) {
              const fbMsg = fallbackResult.error.message?.toLowerCase() || "";
              if (
                fbMsg.includes("fetch failed") ||
                fbMsg.includes("network") ||
                fbMsg.includes("timeout") ||
                fallbackResult.error.status === 0
              ) {
                isNetworkError = true;
              } else {
                return { error: fallbackResult.error.message };
              }
            }
          } else {
            return { error: result.error.message };
          }
        } else {
          return { error: result.error.message };
        }
      }
    }
  } catch {
    isNetworkError = true;
  }

  // Offline Fallback: If network is offline, authenticate locally against PostgreSQL
  if (isNetworkError && !authUserId) {
    const localUser = await prisma.user.findFirst({
      where: {
        OR: [
          { name: { equals: identifier, mode: "insensitive" } },
          { name: { equals: resolvedEmail.split("@")[0], mode: "insensitive" } },
        ],
      },
    });

    if (localUser) {
      if (!localUser.isActive) {
        return { error: "Your account has been deactivated. Please contact an Owner." };
      }

      if (localUser.pinHash && verifyPassword(password, localUser.pinHash)) {
        authUserId = localUser.authUserId;
      } else if (!localUser.pinHash) {
        return {
          error: "Depot PC is offline. Please connect to internet once to cache your credentials locally.",
        };
      } else {
        return { error: "Invalid password for offline login." };
      }
    } else {
      return { error: "Internet is unavailable and local user record was not found." };
    }
  }

  if (!authUserId) {
    return { error: "Authentication failed. Invalid credentials." };
  }

  // Check database User record linked via authUserId
  let dbUser = await prisma.user.findUnique({
    where: { authUserId },
  });

  if (!dbUser) {
    // If the database has 0 users, bootstrap the very first authenticated user as OWNER
    const totalUsers = await prisma.user.count();
    if (totalUsers === 0) {
      dbUser = await prisma.user.create({
        data: {
          authUserId,
          name: resolvedEmail.split("@")[0] || "Owner",
          role: Role.OWNER,
          isActive: true,
          pinHash: hashPassword(password),
        },
      });
    } else {
      return {
        error: "Your account is not registered in the staff database. Contact an Owner.",
      };
    }
  }

  if (!dbUser.isActive) {
    return {
      error: "Your account has been deactivated. Please contact an Owner for assistance.",
    };
  }

  if (!dbUser.pinHash) {
    // Cache the verified password hash in local DB for offline access
    try {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { pinHash: hashPassword(password) },
      });
    } catch {
      // Non-critical background caching
    }
  }

  // Set permanent local session cookie (365 days, HTTP-only, HMAC signed)
  const localSessionToken = await signLocalSession({
    authUserId,
    userId: dbUser.id,
    role: dbUser.role,
    name: dbUser.name,
    email: resolvedEmail,
    createdAt: Date.now(),
  });

  const cookieStore = await cookies();
  cookieStore.set(LOCAL_SESSION_COOKIE, localSessionToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60,
  });

  redirect(redirectTo);
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(LOCAL_SESSION_COOKIE);

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore network error if offline during logout
  }

  redirect("/login");
}
