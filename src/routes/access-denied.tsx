import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/access-denied")({
  head: () => ({
    meta: [
      { title: "Access unavailable | BUS FLOW" },
      { name: "description", content: "This BUS FLOW account cannot access the requested area." },
      { property: "og:title", content: "Access unavailable | BUS FLOW" },
      { property: "og:description", content: "This BUS FLOW account cannot access the requested area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-7 text-center shadow-lg">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </div>
        <div className="mt-5 flex justify-center">
          <BrandLockup />
        </div>
        <h1 className="font-display mt-7 text-2xl font-semibold">Access unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This account is inactive or does not have a BUS FLOW role. Contact an administrator for help.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to="/auth">Return to sign in</Link>
        </Button>
      </section>
    </main>
  );
}