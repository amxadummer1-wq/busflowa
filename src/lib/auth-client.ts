import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/role-access";

export type SignedInAccess = {
  userId: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: AppRole[];
};

export async function getSignedInAccess(): Promise<SignedInAccess | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error("Unable to verify your sign-in. Please try again.");
  const user = userData.user;
  if (!user) return null;

  const [profileResult, roleResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, is_active")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (profileResult.error || roleResult.error) {
    throw new Error("Unable to check your account access. Please try again.");
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profileResult.data?.full_name ?? "",
    isActive: profileResult.data?.is_active === true,
    roles: (roleResult.data ?? []).map((row) => row.role),
  };
}