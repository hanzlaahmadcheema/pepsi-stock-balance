import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppHeader } from "@/components/app-header";
import { CreateStaffUserForm } from "./create-user-form";
import { UserRowActions } from "./user-row-actions";
import { ScrollableTable } from "@/components/ui/scrollable-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "User Management - Pepsi Stock Balance",
  description: "Provision and manage staff members and access permissions",
};

export default async function UsersSettingsPage() {
  // 1. Enforce OWNER role authorization server-side
  const currentUser = await requireRole(Role.OWNER);

  // 2. Fetch all application users from PostgreSQL
  const dbUsers = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });

  // 3. Fetch corresponding email addresses from Supabase Auth Admin
  const emailMap = new Map<string, string>();
  try {
    const supabaseAdmin = createAdminClient();
    const { data: authUsersData } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 200,
    });
    if (authUsersData?.users) {
      for (const u of authUsersData.users) {
        if (u.email) {
          emailMap.set(u.id, u.email);
        }
      }
    }
  } catch (err) {
    console.warn("Could not retrieve auth emails for user list:", err);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={currentUser} />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Staff & User Management</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Provision staff accounts and control application access. Only Owners have access to this section.
              </p>
            </div>
          </div>

          {/* Create Staff Form */}
          <CreateStaffUserForm />

          {/* Users Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Registered Users ({dbUsers.length})
              </h2>
            </div>

            <ScrollableTable>
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th scope="col" className="px-6 py-3">Name</th>
                    <th scope="col" className="px-6 py-3">Username / Email</th>
                    <th scope="col" className="px-6 py-3">Role</th>
                    <th scope="col" className="px-6 py-3">Status</th>
                    <th scope="col" className="px-6 py-3">Created</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {dbUsers.map((u) => {
                    const email = emailMap.get(u.authUserId) || "—";
                    const isOwner = u.role === Role.OWNER;

                    return (
                      <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          {u.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {email.endsWith("@pepsidepot.local") ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-zinc-900 dark:text-zinc-100 font-medium">
                                {email.replace("@pepsidepot.local", "")}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                username
                              </span>
                            </div>
                          ) : (
                            email
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              isOwner
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              u.isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.isActive ? "bg-emerald-500" : "bg-zinc-400"
                              }`}
                            />
                            {u.isActive ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <UserRowActions
                            user={{
                              id: u.id,
                              name: u.name,
                              email,
                              role: u.role,
                              isActive: u.isActive,
                            }}
                            isCurrentOwner={currentUser.role === Role.OWNER}
                            currentUserId={currentUser.id}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      </main>
    </div>
  );
}
