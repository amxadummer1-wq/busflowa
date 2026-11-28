import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  createBusSchema,
  createBusOwnerSchema,
  createOwnerBusSchema,
  updateBusSchema,
  updateBusOwnerSchema,
  updateOwnerBusSchema,
  updateOwnerPaymentSchema,
} from "@/lib/auth-schemas";

type FleetContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export type BusOwnerRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  busCount: number;
};

export type FleetBusRecord = {
  id: string;
  ownerId: string;
  ownerName: string;
  busNumber: string;
  assignedRoute: string;
  upiId: string;
  upiPayeeName: string;
  isActive: boolean;
};

async function assertPlatformAdmin(context: FleetContext): Promise<void> {
  const [adminResult, headAdminResult] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "head_admin" }),
  ]);
  if (adminResult.error || headAdminResult.error || (!adminResult.data && !headAdminResult.data)) {
    throw new Error("Head Admin access is required for this action.");
  }
}

async function assertActiveOwner(context: FleetContext): Promise<void> {
  const [roleResult, profileResult] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "bus_owner" }),
    context.supabase.from("profiles").select("is_active").eq("id", context.userId).maybeSingle(),
  ]);
  if (roleResult.error || !roleResult.data || profileResult.error || !profileResult.data?.is_active) {
    throw new Error("An active Bus Owner account is required.");
  }
}

async function assertBusOwner(context: FleetContext, ownerId: string): Promise<void> {
  const { data: role, error: roleError } = await context.supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", ownerId)
    .eq("role", "bus_owner")
    .maybeSingle();
  if (roleError || !role) throw new Error("Choose an active Bus Owner account.");

  const { data: profile, error: profileError } = await context.supabase
    .from("profiles")
    .select("is_active")
    .eq("id", ownerId)
    .maybeSingle();
  if (profileError || !profile?.is_active) throw new Error("Choose an active Bus Owner account.");
}

export const getAdminOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusOwnerRecord[]> => {
    await assertPlatformAdmin(context);
    const [profilesResult, rolesResult, busesResult] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email, phone, is_active").order("full_name"),
      context.supabase.from("user_roles").select("user_id").eq("role", "bus_owner"),
      context.supabase.from("buses").select("owner_id"),
    ]);
    if (profilesResult.error || rolesResult.error || busesResult.error) {
      throw new Error("Bus Owner records could not be loaded.");
    }

    const ownerIds = new Set((rolesResult.data ?? []).map((row) => row.user_id));
    const busCounts = new Map<string, number>();
    for (const bus of busesResult.data ?? []) {
      busCounts.set(bus.owner_id, (busCounts.get(bus.owner_id) ?? 0) + 1);
    }

    return (profilesResult.data ?? [])
      .filter((profile) => ownerIds.has(profile.id))
      .map((profile) => ({
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email ?? "",
        phone: profile.phone,
        isActive: profile.is_active,
        busCount: busCounts.get(profile.id) ?? 0,
      }));
  });

export const getAdminBuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ buses: FleetBusRecord[]; owners: Pick<BusOwnerRecord, "id" | "fullName">[] }> => {
    await assertPlatformAdmin(context);
    const [busesResult, profilesResult, ownersResult] = await Promise.all([
      context.supabase
        .from("buses")
        .select("id, owner_id, bus_number, assigned_route, upi_id, upi_payee_name, is_active")
        .order("bus_number"),
      context.supabase.from("profiles").select("id, full_name"),
      context.supabase.from("user_roles").select("user_id").eq("role", "bus_owner"),
    ]);
    if (busesResult.error || profilesResult.error || ownersResult.error) {
      throw new Error("Fleet records could not be loaded.");
    }

    const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
    const ownerIds = new Set((ownersResult.data ?? []).map((row) => row.user_id));
    const buses = (busesResult.data ?? []).map((bus) => ({
      id: bus.id,
      ownerId: bus.owner_id,
      ownerName: profileNames.get(bus.owner_id) ?? "Bus Owner",
      busNumber: bus.bus_number,
      assignedRoute: bus.assigned_route ?? "",
      upiId: bus.upi_id ?? "",
      upiPayeeName: bus.upi_payee_name ?? "",
      isActive: bus.is_active,
    }));
    const owners = (profilesResult.data ?? [])
      .filter((profile) => ownerIds.has(profile.id))
      .map((profile) => ({ id: profile.id, fullName: profile.full_name }));
    return { buses, owners };
  });

export const createManagedBus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createBusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    await assertBusOwner(context, data.ownerId);
    const { error } = await context.supabase.from("buses").insert({
      owner_id: data.ownerId,
      bus_number: data.busNumber,
      assigned_route: data.assignedRoute,
      upi_id: data.upiId || null,
      upi_payee_name: data.upiPayeeName || null,
      is_active: data.isActive,
    });
    if (error) throw new Error("The bus could not be added. Check its number and owner.");
    return { success: true };
  });

export const updateManagedBus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateBusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    await assertBusOwner(context, data.ownerId);
    const { data: bus, error } = await context.supabase
      .from("buses")
      .update({
        owner_id: data.ownerId,
        bus_number: data.busNumber,
        assigned_route: data.assignedRoute,
        upi_id: data.upiId || null,
        upi_payee_name: data.upiPayeeName || null,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error || !bus) throw new Error("The bus details could not be saved.");
    return { success: true };
  });

export const getOwnerWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertActiveOwner(context);
    const [profileResult, busesResult, ticketsResult] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("full_name, phone, upi_id, upi_payee_name")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("buses")
        .select("id, owner_id, bus_number, assigned_route, upi_id, upi_payee_name, is_active")
        .eq("owner_id", context.userId)
        .order("bus_number"),
      context.supabase
        .from("tickets")
        .select("id, ticket_code, bus_number, destination, fare_amount, payment_status, created_at")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (profileResult.error || !profileResult.data || busesResult.error || ticketsResult.error) {
      throw new Error("The Bus Owner workspace could not be loaded.");
    }

    const busNumbers = (busesResult.data ?? []).map((bus) => bus.bus_number);
    const staffResult = busNumbers.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name, email, assigned_bus, assigned_route, is_active")
          .in("assigned_bus", busNumbers)
          .order("full_name")
      : { data: [], error: null };
    if (staffResult.error) throw new Error("Assigned Conductor records could not be loaded.");

    return {
      profile: {
        fullName: profileResult.data.full_name,
        phone: profileResult.data.phone,
        upiId: profileResult.data.upi_id ?? "",
        upiPayeeName: profileResult.data.upi_payee_name ?? "",
      },
      buses: (busesResult.data ?? []).map((bus) => ({
        id: bus.id,
        busNumber: bus.bus_number,
        assignedRoute: bus.assigned_route ?? "",
        upiId: bus.upi_id ?? "",
        upiPayeeName: bus.upi_payee_name ?? "",
        isActive: bus.is_active,
      })),
      conductors: (staffResult.data ?? []).map((profile) => ({
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email ?? "",
        assignedBus: profile.assigned_bus ?? "",
        assignedRoute: profile.assigned_route ?? "",
        isActive: profile.is_active,
      })),
      tickets: (ticketsResult.data ?? []).map((ticket) => ({
        id: ticket.id,
        ticketCode: ticket.ticket_code,
        busNumber: ticket.bus_number,
        destination: ticket.destination,
        fareAmount: ticket.fare_amount,
        paymentStatus: ticket.payment_status,
        createdAt: ticket.created_at,
      })),
    };
  });

export const updateOwnerPaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateOwnerPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertActiveOwner(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({
        upi_id: data.upiId || null,
        upi_payee_name: data.upiPayeeName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw new Error("Payment details could not be saved.");
    return { success: true };
  });

export const createOwnerBus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createOwnerBusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertActiveOwner(context);
    const { error } = await context.supabase.from("buses").insert({
      owner_id: context.userId,
      bus_number: data.busNumber,
      assigned_route: data.assignedRoute,
      upi_id: data.upiId || null,
      upi_payee_name: data.upiPayeeName || null,
      is_active: data.isActive,
    });
    if (error) throw new Error("The bus could not be added. Check its number and route.");
    return { success: true };
  });

export const updateOwnerBus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateOwnerBusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertActiveOwner(context);
    const { data: bus, error } = await context.supabase
      .from("buses")
      .update({
        bus_number: data.busNumber,
        assigned_route: data.assignedRoute,
        upi_id: data.upiId || null,
        upi_payee_name: data.upiPayeeName || null,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error || !bus) throw new Error("The bus details could not be saved.");
    return { success: true };
  });