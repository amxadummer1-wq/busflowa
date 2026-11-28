import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Enums } from "@/integrations/supabase/types";
import {
  createBusOwnerSchema,
  createConductorSchema,
  deleteConductorSchema,
  resetConductorPasswordSchema,
  updateBusOwnerSchema,
  updateConductorSchema,
} from "@/lib/auth-schemas";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

type AppRole = Enums<"app_role">;

export type StaffRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  assignedBus: string;
  assignedRoute: string;
  isActive: boolean;
};

export type AdminWorkspace = {
  adminName: string;
  stats: {
    totalBuses: number;
    activeRoutes: number;
    totalConductors: number;
    todaysBookings: number;
  };
  staff: StaffRecord[];
};

async function assertAdmin(context: AuthContext): Promise<void> {
  const [adminResult, headAdminResult] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "head_admin" }),
  ]);
  if (adminResult.error || headAdminResult.error || (!adminResult.data && !headAdminResult.data)) {
    throw new Error("Head Admin access is required for this action.");
  }
}

async function assertConductorTarget(context: AuthContext, targetUserId: string): Promise<void> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", targetUserId)
    .eq("role", "conductor")
    .maybeSingle();
  if (error || !data) throw new Error("This conductor account is no longer available.");
}

export const getAdminWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminWorkspace> => {
    await assertAdmin(context);
    const indiaNow = new Date(Date.now() + 330 * 60 * 1000);
    const indiaDayStart = new Date(Date.UTC(
      indiaNow.getUTCFullYear(),
      indiaNow.getUTCMonth(),
      indiaNow.getUTCDate(),
    ) - 330 * 60 * 1000).toISOString();
    const [profilesResult, rolesResult, busesResult, ticketsResult] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, email, full_name, phone, assigned_bus, assigned_route, is_active")
        .order("full_name"),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase.from("buses").select("id, bus_number, assigned_route, is_active"),
      context.supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", indiaDayStart),
    ]);

    if (profilesResult.error || rolesResult.error || busesResult.error || ticketsResult.error) {
      throw new Error("The Admin workspace could not be loaded. Please refresh and try again.");
    }

    const rolesByUser = new Map<string, AppRole[]>();
    for (const roleRow of rolesResult.data ?? []) {
      const currentRoles = rolesByUser.get(roleRow.user_id) ?? [];
      currentRoles.push(roleRow.role);
      rolesByUser.set(roleRow.user_id, currentRoles);
    }

    const staff = (profilesResult.data ?? [])
      .filter((profile) => rolesByUser.get(profile.id)?.includes("conductor") === true)
      .map((profile): StaffRecord => ({
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email ?? "",
        phone: profile.phone,
        assignedBus: profile.assigned_bus ?? "",
        assignedRoute: profile.assigned_route ?? "",
        isActive: profile.is_active,
      }));

    const activeRoutes = new Set<string>();
    for (const bus of busesResult.data ?? []) {
      if (bus.is_active && bus.assigned_route) activeRoutes.add(bus.assigned_route);
    }

    const currentAdmin = (profilesResult.data ?? []).find((profile) => profile.id === context.userId);
    return {
      adminName: currentAdmin?.full_name.trim() || "Admin",
      stats: {
        totalBuses: busesResult.data?.length ?? 0,
        activeRoutes: activeRoutes.size,
        totalConductors: staff.length,
        todaysBookings: ticketsResult.count ?? 0,
      },
      staff,
    };
  });

export const createBusOwnerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createBusOwnerSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.initialPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });
    if (error || !created.user) {
      throw new Error("The Bus Owner account could not be created. Check the email and try again.");
    }

    const userId = created.user.id;
    try {
      const { error: removeAdminRoleError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (removeAdminRoleError) throw new Error("Role setup failed.");

      const { error: addOwnerRoleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "bus_owner" });
      if (addOwnerRoleError) throw new Error("Role setup failed.");

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ email: data.email, full_name: data.fullName, phone: data.phone })
        .eq("id", userId);
      if (profileError) throw new Error("Profile setup failed.");
    } catch {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("The Bus Owner account could not be completed. No account was kept.");
    }

    return { success: true, id: userId };
  });

export const updateBusOwnerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateBusOwnerSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: ownerRole, error: roleError } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.id)
      .eq("role", "bus_owner")
      .maybeSingle();
    if (roleError || !ownerRole) throw new Error("This Bus Owner account is no longer available.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.id)
      .maybeSingle();
    if (profileLookupError || !existingProfile) throw new Error("The Bus Owner profile could not be found.");

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });
    if (authError) throw new Error("The Bus Owner account could not be updated.");

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        email: data.email,
        full_name: data.fullName,
        phone: data.phone,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateError) {
      if (existingProfile.email) {
        await supabaseAdmin.auth.admin.updateUserById(data.id, {
          email: existingProfile.email,
          email_confirm: true,
        });
      }
      throw new Error("The Bus Owner details could not be saved.");
    }
    return { success: true };
  });

export const createConductorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createConductorSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.initialPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });

    if (error || !created.user) {
      throw new Error("The conductor account could not be created. Check the email and try again.");
    }

    const userId = created.user.id;
    try {
      const { error: removeAdminRoleError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (removeAdminRoleError) throw new Error("Role setup failed.");

      const { error: addConductorRoleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "conductor" });
      if (addConductorRoleError) throw new Error("Role setup failed.");

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          assigned_bus: data.assignedBus || null,
          assigned_route: data.assignedRoute || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (profileError) throw new Error("Profile setup failed.");
    } catch {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("The conductor account could not be completed. No account was kept.");
    }

    return { success: true, id: userId };
  });

export const updateConductorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateConductorSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await assertConductorTarget(context, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.id)
      .maybeSingle();
    if (existingProfileError || !existingProfile) {
      throw new Error("This conductor profile could not be found.");
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });
    if (authError) throw new Error("The email address could not be updated.");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        email: data.email,
        full_name: data.fullName,
        phone: data.phone,
        assigned_bus: data.assignedBus || null,
        assigned_route: data.assignedRoute || null,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (profileError) {
      if (existingProfile.email) {
        await supabaseAdmin.auth.admin.updateUserById(data.id, {
          email: existingProfile.email,
          email_confirm: true,
        });
      }
      throw new Error("The conductor details could not be saved.");
    }

    return { success: true };
  });

export const resetConductorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => resetConductorPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await assertConductorTarget(context, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error("The password could not be reset.");
    return { success: true };
  });

export const deleteConductorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteConductorSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await assertConductorTarget(context, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error("The conductor account could not be deleted.");
    return { success: true };
  });