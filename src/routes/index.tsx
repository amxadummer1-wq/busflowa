import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import busSplash from "@/assets/bus-splash.webp";
import { BrandLockup } from "@/components/brand-lockup";
import { getSignedInAccess } from "@/lib/auth-client";
import { homeForRoles } from "@/lib/role-access";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BUS FLOW — Smart Bus Operations" },
      { name: "description", content: "Ride smart and manage your bus operations with BUS FLOW." },
      { property: "og:title", content: "BUS FLOW — Smart Bus Operations" },
      { property: "og:description", content: "Ride smart and manage your bus operations with BUS FLOW." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SplashScreen,
});

function SplashScreen() {
  const navigate = useNavigate({ from: "/" });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const access = await getSignedInAccess();
          const destination = access
            ? homeForRoles(access.roles, access.isActive)
            : "/auth";
          await navigate({ to: destination, replace: true });
        } catch {
          await navigate({ to: "/auth", replace: true });
        }
      })();
    }, prefersReducedMotion ? 700 : 2400);

    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background px-6 py-12 text-center sm:py-16">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <BrandLockup alignment="center" size="large" />
        <p className="text-sm font-medium text-muted-foreground sm:text-base">
          Ride Smart. Travel Better.
        </p>
        <div className="bus-journey-track mt-6" aria-label="Bus moving along a road">
          <img className="bus-journey-image" src={busSplash} alt="Blue intercity coach" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="bus-loading-bar h-1 w-24 rounded-full bg-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Connecting to your journey...</p>
        </div>
      </div>
      <p className="text-xs font-semibold uppercase text-primary">BUS FLOW</p>
    </main>
  );
}