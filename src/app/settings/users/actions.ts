"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { assertNotCloudPortal } from "@/lib/config/portal-mode";
import { Role } from "@prisma/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";

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
  assertNotCloudPortal("Create Staff User");
  let ownerUser;
  try {
    // 1. Enforce OWNER role server-side
    ownerUser = await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can provision new user accounts." };
  }

  const name = (formData.get("name") as string)?.trim();
  let email = ((formData.get("email") || formData.get("identifier")) as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const roleInput = (formData.get("role") as string)?.trim().toUpperCase();
  const role: Role = roleInput === "OWNER" ? Role.OWNER : Role.STAFF;

  // 2. Validate input
  if (!name || name.length < 2) {
    return { error: "Full name must be at least 2 characters long." };
  }

  if (!email) {
    return { error: "Username or email address is required." };
  }

  // If input doesn't contain an @, treat as local username
  if (!email.includes("@")) {
    email = `${email.replace(/\s+/g, "")}@pepsidepot.local`;
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
    app_metadata: { role },
  });

  if (authError || !authData?.user) {
    const errorMsg = authError?.message || "Failed to create user in authentication provider.";
    if (errorMsg.toLowerCase().includes("already") || errorMsg.toLowerCase().includes("registered")) {
      return { error: "A user with this email or username already exists." };
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
        role,
        isActive: true,
        pinHash: hashPassword(password),
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
          role,
        },
        reason: `${role === Role.OWNER ? "Owner (Administrator)" : "Staff"} account created for "${name}" (${email})`,
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
    message: `${role === Role.OWNER ? "Owner" : "Staff"} user "${name}" (${email}) successfully created.`,
  };
}

/**
 * Server action for an OWNER to activate or deactivate any user (Staff or Owner).
 * Owners cannot deactivate themselves.
 */
export async function toggleUserStatusAction(userId: string): Promise<{ error?: string; success?: boolean }> {
  assertNotCloudPortal("Toggle User Status");
  let ownerUser;
  try {
    // 1. Enforce OWNER role server-side
    ownerUser = await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can change user status." };
  }

  // 2. Retrieve target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return { error: "User not found." };
  }

  // 3. An Owner cannot deactivate themselves
  if (targetUser.id === ownerUser.id) {
    return { error: "Security restriction: You cannot deactivate your own account." };
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
      reason: `${targetUser.role} "${targetUser.name}" ${newStatus ? "activated" : "deactivated"} by Owner "${ownerUser.name}"`,
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
 * Server action for an OWNER to update any user's details (name, email, password, role).
 * An Owner cannot change their own role to avoid self-lockout.
 */
export async function updateStaffUserAction(
  _prevState: EditStaffState | null,
  formData: FormData
): Promise<EditStaffState> {
  assertNotCloudPortal("Update Staff User");
  let ownerUser;
  try {
    ownerUser = await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can update user accounts." };
  }

  const userId = (formData.get("userId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  let email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = (formData.get("password") as string)?.trim();
  const roleInput = (formData.get("role") as string)?.trim().toUpperCase();
  const newRole: Role | null = roleInput === "OWNER" ? Role.OWNER : roleInput === "STAFF" ? Role.STAFF : null;

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
    return { error: "User not found." };
  }

  // An Owner cannot change their own role (would lock themselves out)
  if (newRole && newRole !== targetUser.role && targetUser.id === ownerUser.id) {
    return { error: "Security restriction: You cannot change your own role." };
  }

  const supabaseAdmin = createAdminClient();

  const authUpdates: {
    email?: string;
    password?: string;
    user_metadata?: { name: string };
    app_metadata?: { role: Role };
  } = {
    user_metadata: { name },
  };

  if (newRole && newRole !== targetUser.role) {
    authUpdates.app_metadata = { role: newRole };
  }

  if (email) {
    if (!email.includes("@")) {
      email = `${email.replace(/\s+/g, "")}@pepsidepot.local`;
    }
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

  // Update Prisma User — include role if it changed, and cache new password hash
  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      ...(newRole && newRole !== targetUser.role && { role: newRole }),
      ...(password && { pinHash: hashPassword(password) }),
    },
  });

  const effectiveRole = newRole ?? targetUser.role;

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: ownerUser.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: targetUser.id,
      oldValues: { name: targetUser.name, role: targetUser.role },
      newValues: {
        name,
        role: effectiveRole,
        email: email || undefined,
        passwordUpdated: Boolean(password),
      },
      reason: `User "${name}" updated by Owner "${ownerUser.name}"${newRole && newRole !== targetUser.role ? ` (role changed: ${targetUser.role} → ${newRole})` : ""}`,
    },
  });

  revalidatePath("/settings/users");
  return {
    success: true,
    message: `User "${name}" updated successfully.`,
  };
}
