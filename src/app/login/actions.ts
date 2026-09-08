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
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

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
          name: data.user.user_metadata?.name || email.split("@")[0] || "Owner",
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
