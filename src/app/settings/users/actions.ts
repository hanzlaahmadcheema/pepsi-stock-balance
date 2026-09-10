"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateStaffState = {
  error?: string;
  success?: boolean;
  message?: string;
};

/**
 * Server action for an OWNER to provision a new STAFF user.
 * Strictly verifies OWNER role server-side.
 */
export async function createStaffUserAction(
  _prevState: CreateStaffState | null,
  formData: FormData
): Promise<CreateStaffState> {
  let ownerUser;
  try {
    // 1. Enforce OWNER role server-side
    ownerUser = await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can provision new staff accounts." };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  // 2. Validate input
  if (!name || name.length < 2) {
    return { error: "Full name must be at least 2 characters long." };
  }

  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  const supabaseAdmin = createAdminClient();

  // 3. Create the user in Supabase Auth via Admin API
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role: Role.STAFF },
  });

  if (authError || !authData?.user) {
    const errorMsg = authError?.message || "Failed to create user in authentication provider.";
    if (errorMsg.toLowerCase().includes("already") || errorMsg.toLowerCase().includes("registered")) {
      return { error: "A user with this email address already exists." };
    }
    return { error: errorMsg };
  }

  const authUserId = authData.user.id;

  // 4. Create corresponding Prisma User record
  try {
    const newUser = await prisma.user.create({
      data: {
        authUserId,
        name,
        role: Role.STAFF,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: ownerUser.id,
        action: "CREATE_USER",
        entityType: "User",
        entityId: newUser.id,
        newValues: {
          name,
          email,
          role: Role.STAFF,
        },
        reason: `Staff account created for "${name}" (${email})`,
      },
    });
  } catch (dbError) {
    // Roll back auth user creation to prevent orphaned auth records
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    console.error("Failed to create Prisma User record:", dbError);
    return { error: "Database error while linking user record. Auth user was rolled back." };
  }

  revalidatePath("/settings/users");
  return {
    success: true,
    message: `Staff user "${name}" (${email}) successfully created.`,
  };
}

/**
 * Server action for an OWNER to activate or deactivate a STAFF user.
 * Strictly verifies OWNER role server-side and forbids mutating OWNER accounts.
 */
export async function toggleUserStatusAction(userId: string): Promise<{ error?: string; success?: boolean }> {
  let ownerUser;
  try {
    // 1. Enforce OWNER role server-side
    ownerUser = await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can change staff status." };
  }

  // 2. Retrieve target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return { error: "User not found." };
  }

  // 3. Prevent modification of OWNER accounts through staff-management UI
  if (targetUser.role === Role.OWNER) {
    return { error: "Security restriction: Cannot modify or deactivate an Owner account." };
  }

  const newStatus = !targetUser.isActive;

  // 4. Update status in database
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: newStatus },
  });

  // 5. Create immutable AuditLog
  await prisma.auditLog.create({
    data: {
      userId: ownerUser.id,
      action: newStatus ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityType: "User",
      entityId: targetUser.id,
      oldValues: { isActive: targetUser.isActive },
      newValues: { isActive: newStatus },
      reason: `Staff user "${targetUser.name}" ${newStatus ? "activated" : "deactivated"} by Owner`,
    },
  });

  // 6. If deactivating, immediately revoke active sessions via Supabase Admin
  if (!newStatus) {
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.signOut(targetUser.authUserId);
    } catch (err) {
      console.warn("Could not sign out deactivated user sessions from auth provider:", err);
    }
  }

  revalidatePath("/settings/users");
  return { success: true };
}

export type EditStaffState = {
  error?: string;
  success?: boolean;
  message?: string;
};

/**
 * Server action for an OWNER to update a STAFF user's details.
 */
export async function updateStaffUserAction(
  _prevState: EditStaffState | null,
  formData: FormData
): Promise<EditStaffState> {
  let ownerUser;
  try {
    ownerUser = await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can update staff accounts." };
  }

  const userId = (formData.get("userId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = (formData.get("password") as string)?.trim();

  if (!userId) {
    return { error: "User ID is required." };
  }

  if (!name || name.length < 2) {
    return { error: "Full name must be at least 2 characters long." };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return { error: "Staff member not found." };
  }

  if (targetUser.role === Role.OWNER && targetUser.id !== ownerUser.id) {
    return { error: "Security restriction: Cannot modify another Owner account." };
  }

  const supabaseAdmin = createAdminClient();

  const authUpdates: { email?: string; password?: string; user_metadata?: { name: string } } = {
    user_metadata: { name },
  };

  if (email && email.includes("@")) {
    authUpdates.email = email;
  }

  if (password) {
    if (password.length < 8) {
      return { error: "New password must be at least 8 characters long." };
    }
    authUpdates.password = password;
  }

  try {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.authUserId,
      authUpdates
    );

    if (authError) {
      return { error: authError.message || "Failed to update authentication account." };
    }
  } catch (err: unknown) {
    console.error("Supabase update error:", err);
    return { error: "Failed to update user credentials in authentication service." };
  }

  // Update Prisma User
  await prisma.user.update({
    where: { id: userId },
    data: { name },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: ownerUser.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: targetUser.id,
      oldValues: { name: targetUser.name },
      newValues: { name, email: email || undefined, passwordUpdated: Boolean(password) },
      reason: `Staff account details updated for "${name}" by Owner`,
    },
  });

  revalidatePath("/settings/users");
  return {
    success: true,
    message: `Staff member "${name}" updated successfully.`,
  };
}
