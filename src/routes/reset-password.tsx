import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getSignedInAccess } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/auth-schemas";
import { homeForRoles } from "@/lib/role-access";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password | BUS FLOW" },
      { name: "description", content: "Set a new password for your BUS FLOW account." },
      { property: "og:title", content: "Reset password | BUS FLOW" },
      { property: "og:description", content: "Set a new password for your BUS FLOW account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate({ from: "/reset-password" });
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setRecoveryReady(hash.get("type") === "recovery");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!recoveryReady) {
      setMessage("This reset link is missing or has expired. Request a new one from the sign-in page.");
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check the new password and try again.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      setMessage("The password could not be updated. Request a new reset link and try again.");
      setBusy(false);
      return;
    }

    const access = await getSignedInAccess();
    const destination = access ? homeForRoles(access.roles, access.isActive) : "/auth";
    await navigate({ to: destination, replace: true });
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg sm:p-8">
        <BrandLockup />
        <h1 className="font-display mt-8 text-2xl font-semibold">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a new password for your account.</p>
        {recoveryReady ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="reset-password">
                New password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-password"
                  className="h-12 rounded-md bg-muted/50 pl-10"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="reset-confirm">
                Confirm new password
              </label>
              <Input
                id="reset-confirm"
                className="h-12 rounded-md bg-muted/50"
                type="password"
                autoComplete="new-password"
                maxLength={128}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <Button className="h-12 w-full rounded-md" type="submit" disabled={busy}>
              {busy ? "Updating..." : "Update password"}
            </Button>
          </form>
        ) : (
          <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/auth" })}>
            Return to sign in
          </Button>
        )}
        {message ? (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}