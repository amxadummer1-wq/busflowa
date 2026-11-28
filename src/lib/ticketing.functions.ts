import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { confirmTicketSchema, createTicketSchema } from "@/lib/auth-schemas";
import { buildUpiPaymentUri, buildTicketQrValue, resolvePaymentTarget } from "@/lib/ticketing";

type TicketContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

async function getActiveConductorProfile(context: TicketContext) {
  const [roleResult, profileResult] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "conductor" }),
    context.supabase
      .from("profiles")
      .select("full_name, assigned_bus, assigned_route, is_active")
      .eq("id", context.userId)
      .maybeSingle(),
  ]);
  if (roleResult.error || !roleResult.data || profileResult.error || !profileResult.data?.is_active) {
    throw new Error("An active Conductor account is required.");
  }
  if (!profileResult.data.assigned_bus || !profileResult.data.assigned_route) {
    throw new Error("Ask your administrator to assign a bus and route before creating tickets.");
  }
  return profileResult.data;
}

export const getConductorWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getActiveConductorProfile(context);
    const { data: bus, error: busError } = await context.supabase
      .from("buses")
      .select("id, owner_id, bus_number, assigned_route, upi_id, upi_payee_name, is_active")
      .eq("bus_number", profile.assigned_bus)
      .eq("assigned_route", profile.assigned_route)
      .eq("is_active", true)
      .maybeSingle();
    if (busError || !bus) throw new Error("Your assigned active bus could not be found.");

    const [ticketsResult, ownerResult] = await Promise.all([
      context.supabase
        .from("tickets")
        .select("id, ticket_code, bus_number, assigned_route, boarding_point, destination, passenger_count, fare_amount, payment_status, created_at")
        .eq("conductor_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      (async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return supabaseAdmin
          .from("profiles")
          .select("upi_id, upi_payee_name, is_active")
          .eq("id", bus.owner_id)
          .maybeSingle();
      })(),
    ]);
    if (ticketsResult.error || ownerResult.error || !ownerResult.data?.is_active) {
      throw new Error("Your assigned bus payment details could not be loaded.");
    }

    const paymentTarget = resolvePaymentTarget(
      { upiId: bus.upi_id, payeeName: bus.upi_payee_name },
      { upiId: ownerResult.data.upi_id, payeeName: ownerResult.data.upi_payee_name },
    );

    return {
      conductorName: profile.full_name,
      bus: {
        id: bus.id,
        busNumber: bus.bus_number,
        assignedRoute: bus.assigned_route ?? "",
        paymentReady: paymentTarget !== null,
      },
      tickets: (ticketsResult.data ?? []).map((ticket) => ({
        id: ticket.id,
        ticketCode: ticket.ticket_code,
        busNumber: ticket.bus_number,
        assignedRoute: ticket.assigned_route,
        boardingPoint: ticket.boarding_point,
        destination: ticket.destination,
        passengerCount: ticket.passenger_count,
        fareAmount: ticket.fare_amount,
        paymentStatus: ticket.payment_status,
        createdAt: ticket.created_at,
      })),
    };
  });

export const createConductorTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createTicketSchema.parse(input))
  .handler(async ({ data, context }) => {
    const profile = await getActiveConductorProfile(context);
    const { data: bus, error: busError } = await context.supabase
      .from("buses")
      .select("id, owner_id, bus_number, assigned_route, upi_id, upi_payee_name, is_active")
      .eq("id", data.busId)
      .eq("bus_number", profile.assigned_bus)
      .eq("assigned_route", profile.assigned_route)
      .eq("is_active", true)
      .maybeSingle();
    if (busError || !bus || !bus.assigned_route) {
      throw new Error("Tickets can only be created for your assigned active bus.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ownerProfile, error: ownerError } = await supabaseAdmin
      .from("profiles")
      .select("upi_id, upi_payee_name, is_active")
      .eq("id", bus.owner_id)
      .maybeSingle();
    if (ownerError || !ownerProfile?.is_active) {
      throw new Error("The bus owner account is not active.");
    }

    const paymentTarget = resolvePaymentTarget(
      { upiId: bus.upi_id, payeeName: bus.upi_payee_name },
      { upiId: ownerProfile.upi_id, payeeName: ownerProfile.upi_payee_name },
    );
    if (!paymentTarget) {
      throw new Error("Ask the Bus Owner to add a valid UPI ID and payee name before taking payments.");
    }

    const ticketCode = `BF-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
    const { data: ticket, error: insertError } = await context.supabase
      .from("tickets")
      .insert({
        ticket_code: ticketCode,
        owner_id: bus.owner_id,
        bus_id: bus.id,
        conductor_id: context.userId,
        bus_number: bus.bus_number,
        assigned_route: bus.assigned_route,
        boarding_point: data.boardingPoint,
        destination: data.destination,
        passenger_count: data.passengerCount,
        fare_amount: data.fareAmount,
        upi_id: paymentTarget.upiId,
        upi_payee_name: paymentTarget.payeeName,
        payment_status: "pending",
      })
      .select("id, ticket_code, bus_number, assigned_route, boarding_point, destination, passenger_count, fare_amount, upi_id, upi_payee_name, payment_status, created_at")
      .single();
    if (insertError || !ticket) throw new Error("The ticket could not be created. Please try again.");

    const upiUri = buildUpiPaymentUri({
      upiId: ticket.upi_id,
      payeeName: ticket.upi_payee_name,
      amount: ticket.fare_amount,
      ticketCode: ticket.ticket_code,
    });

    return {
      id: ticket.id,
      ticketCode: ticket.ticket_code,
      busNumber: ticket.bus_number,
      assignedRoute: ticket.assigned_route,
      boardingPoint: ticket.boarding_point,
      destination: ticket.destination,
      passengerCount: ticket.passenger_count,
      fareAmount: ticket.fare_amount,
      upiId: ticket.upi_id,
      upiPayeeName: ticket.upi_payee_name,
      paymentStatus: ticket.payment_status,
      createdAt: ticket.created_at,
      upiUri,
      ticketQrValue: buildTicketQrValue(ticket.ticket_code),
    };
  });

export const confirmConductorTicketPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmTicketSchema.parse(input))
  .handler(async ({ data, context }) => {
    await getActiveConductorProfile(context);
    const confirmedAt = new Date().toISOString();
    const { data: ticket, error } = await context.supabase
      .from("tickets")
      .update({
        payment_status: "confirmed",
        payment_confirmed_by: context.userId,
        payment_confirmed_at: confirmedAt,
      })
      .eq("id", data.id)
      .eq("conductor_id", context.userId)
      .eq("payment_status", "pending")
      .select("id, ticket_code, payment_status, payment_confirmed_at")
      .maybeSingle();
    if (error || !ticket) {
      throw new Error("Payment was not confirmed. Check the ticket and payment receipt.");
    }
    return {
      id: ticket.id,
      ticketCode: ticket.ticket_code,
      paymentStatus: ticket.payment_status,
      paymentConfirmedAt: ticket.payment_confirmed_at,
      ticketQrValue: buildTicketQrValue(ticket.ticket_code),
    };
  });