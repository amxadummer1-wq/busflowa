ALTER TABLE public.profiles
  ADD COLUMN upi_id text,
  ADD COLUMN upi_payee_name text,
  ADD CONSTRAINT profiles_upi_id_length CHECK (upi_id IS NULL OR char_length(upi_id) <= 255),
  ADD CONSTRAINT profiles_upi_payee_name_length CHECK (upi_payee_name IS NULL OR char_length(upi_payee_name) <= 120);

GRANT UPDATE (upi_id, upi_payee_name) ON TABLE public.profiles TO authenticated;

CREATE TABLE public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  bus_number text NOT NULL,
  assigned_route text,
  upi_id text,
  upi_payee_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buses_bus_number_length CHECK (char_length(btrim(bus_number)) BETWEEN 1 AND 40),
  CONSTRAINT buses_assigned_route_length CHECK (assigned_route IS NULL OR char_length(assigned_route) <= 120),
  CONSTRAINT buses_upi_id_length CHECK (upi_id IS NULL OR char_length(upi_id) <= 255),
  CONSTRAINT buses_upi_payee_name_length CHECK (upi_payee_name IS NULL OR char_length(upi_payee_name) <= 120)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buses TO authenticated;
GRANT ALL ON public.buses TO service_role;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;

DROP POLICY "Users read own profile and admins read all profiles" ON public.profiles;
CREATE POLICY "Users read own profile and admins read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'head_admin'::public.app_role)
  );
CREATE POLICY "Bus owners update their own payment profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.has_role(auth.uid(), 'bus_owner'::public.app_role))
  WITH CHECK (id = auth.uid() AND public.has_role(auth.uid(), 'bus_owner'::public.app_role));
CREATE POLICY "Head admins update payment profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'head_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'head_admin'::public.app_role)
  );

DROP POLICY "Users read own role and admins read all roles" ON public.user_roles;
CREATE POLICY "Users read own role and admins read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'head_admin'::public.app_role)
  );

CREATE POLICY "Bus owners manage their own buses"
  ON public.buses FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    AND public.has_role(auth.uid(), 'bus_owner'::public.app_role)
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND public.has_role(auth.uid(), 'bus_owner'::public.app_role)
  );
CREATE POLICY "Head admins manage all buses"
  ON public.buses FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'head_admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'head_admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.handle_bus_flow_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  profile_email text := lower(nullif(btrim(NEW.email), ''));
  profile_name text := left(btrim(coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')), 120);
  profile_phone text := left(btrim(coalesce(NEW.raw_user_meta_data ->> 'phone', '')), 32);
BEGIN
  IF profile_name = '' THEN
    profile_name := left(coalesce(nullif(split_part(coalesce(profile_email, ''), '@', 1), ''), 'BUS FLOW user'), 120);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, profile_email, profile_name, profile_phone)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        updated_at = now();

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.handle_bus_flow_auth_user_created() IS 'Creates a profile for new auth accounts; roles are assigned only through authorized account provisioning.';