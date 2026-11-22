import type { QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export async function signOutAndClear(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("You could not be signed out. Please try again.");
}