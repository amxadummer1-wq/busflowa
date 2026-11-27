CREATE POLICY "Conductors read their assigned active buses"
ON public.buses
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'conductor'::public.app_role)
  AND is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS conductor_profile
    WHERE conductor_profile.id = auth.uid()
      AND conductor_profile.is_active = true
      AND conductor_profile.assigned_bus = buses.bus_number
      AND conductor_profile.assigned_route = buses.assigned_route
  )
);

CREATE POLICY "Bus owners read conductors assigned to their buses"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'bus_owner'::public.app_role)
  AND public.has_role(profiles.id, 'conductor'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.buses AS owner_bus
    WHERE owner_bus.owner_id = auth.uid()
      AND owner_bus.bus_number = profiles.assigned_bus
  )
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  bus_id uuid NOT NULL REFERENCES public.buses(id),
  conductor_id uuid NOT NULL,
  bus_number text NOT NULL,
  assigned_route text NOT NULL,
  boarding_point text NOT NULL,
  destination text NOT NULL,
  passenger_count integer NOT NULL DEFAULT 1 CHECK (passenger_count > 0),
  fare_amount numeric(10, 2) NOT NULL CHECK (fare_amount > 0),
  upi_id text NOT NULL,
  upi_payee_name text NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed')),
  payment_confirmed_by uuid,
  payment_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tickets_payment_confirmation_consistency CHECK (
    (payment_status = 'confirmed' AND payment_confirmed_by IS NOT NULL AND payment_confirmed_at IS NOT NULL)
    OR
    (payment_status = 'pending' AND payment_confirmed_by IS NULL AND payment_confirmed_at IS NULL)
  )
);

GRANT SELECT, INSERT ON public.tickets TO authenticated;
GRANT UPDATE (payment_status, payment_confirmed_by, payment_confirmed_at) ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Head admins read all tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'head_admin'::public.app_role)
);

CREATE POLICY "Bus owners read their fleet tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  AND public.has_role(auth.uid(), 'bus_owner'::public.app_role)
);

CREATE POLICY "Conductors read their own tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  conductor_id = auth.uid()
  AND public.has_role(auth.uid(), 'conductor'::public.app_role)
);

CREATE POLICY "Conductors create tickets for their assigned active bus"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  conductor_id = auth.uid()
  AND public.has_role(auth.uid(), 'conductor'::public.app_role)
  AND payment_status = 'pending'
  AND payment_confirmed_by IS NULL
  AND payment_confirmed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS conductor_profile
    WHERE conductor_profile.id = auth.uid()
      AND conductor_profile.is_active = true
      AND conductor_profile.assigned_bus = tickets.bus_number
      AND conductor_profile.assigned_route = tickets.assigned_route
  )
  AND EXISTS (
    SELECT 1
    FROM public.buses AS assigned_bus
    WHERE assigned_bus.id = tickets.bus_id
      AND assigned_bus.owner_id = tickets.owner_id
      AND assigned_bus.bus_number = tickets.bus_number
      AND assigned_bus.assigned_route = tickets.assigned_route
      AND assigned_bus.is_active = true
  )
);

CREATE POLICY "Conductors confirm payment for their pending tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  conductor_id = auth.uid()
  AND public.has_role(auth.uid(), 'conductor'::public.app_role)
  AND payment_status = 'pending'
)
WITH CHECK (
  conductor_id = auth.uid()
  AND public.has_role(auth.uid(), 'conductor'::public.app_role)
  AND payment_status = 'confirmed'
  AND payment_confirmed_by = auth.uid()
  AND payment_confirmed_at IS NOT NULL
);

CREATE INDEX tickets_conductor_created_at_idx ON public.tickets (conductor_id, created_at DESC);
CREATE INDEX tickets_owner_created_at_idx ON public.tickets (owner_id, created_at DESC);
CREATE INDEX tickets_bus_id_idx ON public.tickets (bus_id);