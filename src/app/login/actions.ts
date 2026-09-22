"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

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

  const supabase = await createClient();
  let { data, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  // Secondary fallback: if custom name lookup failed, try standard depot username alias
  if (error && !identifier.includes("@")) {
    const aliasEmail = `${identifier.toLowerCase().replace(/\s+/g, "")}@pepsidepot.local`;
    if (aliasEmail !== resolvedEmail) {
      const fallbackResult = await supabase.auth.signInWithPassword({
        email: aliasEmail,
        password,
      });
      if (!fallbackResult.error && fallbackResult.data.user) {
        data = fallbackResult.data;
        error = null;
      }
    }
  }

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Authentication failed. Invalid credentials." };
  }

  // Check database User record linked via authUserId
  const dbUser = await prisma.user.findUnique({
    where: { authUserId: data.user.id },
  });

  if (!dbUser) {
    // If the database has 0 users, bootstrap the very first authenticated user as OWNER
    const totalUsers = await prisma.user.count();
    if (totalUsers === 0) {
      await prisma.user.create({
        data: {
          authUserId: data.user.id,
          name: data.user.user_metadata?.name || resolvedEmail.split("@")[0] || "Owner",
          role: Role.OWNER,
          isActive: true,
        },
      });
    } else {
      await supabase.auth.signOut();
      return {
        error: "Your account is not registered in the staff database. Contact an Owner.",
      };
    }
  } else if (!dbUser.isActive) {
    await supabase.auth.signOut();
    return {
      error: "Your account has been deactivated. Please contact an Owner for assistance.",
    };
  }

  redirect(redirectTo);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
