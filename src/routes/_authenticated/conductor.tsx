import { createFileRoute, redirect } from "@tanstack/react-router";

import { BrandLockup } from "@/components/brand-lockup";
import { getSignedInAccess } from "@/lib/auth-client";
import { canAccessDashboard, homeForRoles } from "@/lib/role-access";

export const Route = createFileRoute("/_authenticated/conductor")({
  head: () => ({
    meta: [
      { title: "Conductor | BUS FLOW" },
      { name: "description", content: "Your BUS FLOW Conductor workspace." },
      { property: "og:title", content: "Conductor | BUS FLOW" },
      { property: "og:description", content: "Your BUS FLOW Conductor workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const access = await getSignedInAccess();
    if (!access) throw redirect({ to: "/auth" });
    if (!canAccessDashboard(access.roles, "conductor", access.isActive)) {
      throw redirect({ to: homeForRoles(access.roles, access.isActive) });
    }
    return { access };
  },
  component: ConductorDestination,
});

function ConductorDestination() {
  const { access } = Route.useRouteContext();

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <BrandLockup />
          <span className="text-sm font-medium text-muted-foreground">Conductor</span>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-medium text-primary">Conductor workspace</p>
        <h1 className="font-display mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
          Welcome, {access.fullName || "Conductor"}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          Your account is active. The Conductor workspace is not available yet.
        </p>
      </section>
    </main>
  );
}