import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";

import busSplash from "@/assets/bus-splash.webp";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { getSignedInAccess } from "@/lib/auth-client";
import {
  adminRegistrationSchema,
  forgotPasswordSchema,
  signInSchema,
} from "@/lib/auth-schemas";
import { homeForRoles } from "@/lib/role-access";

type AuthMode = "login" | "register" | "forgot";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | BUS FLOW" },
      { name: "description", content: "Sign in or create an Admin account for BUS FLOW." },
      { property: "og:title", content: "Sign in | BUS FLOW" },
      { property: "og:description", content: "Sign in or create an Admin account for BUS FLOW." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate({ from: "/auth" });
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("bus-flow-remembered-email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  function clearMessages() {
    setErrorText("");
    setNotice("");
  }

  async function continueToDashboard(): Promise<void> {
    const access = await getSignedInAccess();
    const destination = access
      ? homeForRoles(access.roles, access.isActive)
      : "/access-denied";

    if (destination === "/access-denied") {
      await supabase.auth.signOut();
      setErrorText(
        access?.isActive === false
          ? "This account is inactive. Please contact an administrator."
          : "This account does not have an active BUS FLOW role.",
      );
      return;
    }

    if (rememberEmail && email) {
      window.localStorage.setItem("bus-flow-remembered-email", email.trim().toLowerCase());
    } else {
      window.localStorage.removeItem("bus-flow-remembered-email");
    }
    await navigate({ to: destination, replace: true });
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrorText(parsed.error.issues[0]?.message ?? "Check your email and password.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setErrorText("That email and password combination could not be verified.");
      setBusy(false);
      return;
    }

    try {
      await continueToDashboard();
    } catch {
      setErrorText("Unable to check your account access. Please try again.");
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    const parsed = adminRegistrationSchema.safeParse({
      fullName,
      email,
      phone,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setErrorText(parsed.error.issues[0]?.message ?? "Check the account details and try again.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      },
    });

    if (error) {
      setErrorText("The Admin account could not be created. Check the details and try again.");
      setBusy(false);
      return;
    }

    if (!data.session) {
      setNotice("Your account was created. Sign in to continue.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setBusy(false);
      return;
    }

    try {
      await continueToDashboard();
    } catch {
      setErrorText("Your account was created, but access could not be checked yet.");
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setErrorText(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setErrorText("A reset email could not be sent. Please wait a moment and try again.");
    } else {
      setNotice("If an account exists for that address, a password reset email is on its way.");
    }
    setBusy(false);
  }

  async function handleSocialSignIn(provider: "google" | "lovable") {
    clearMessages();
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });

    if (result.error) {
      setErrorText("That sign-in option is temporarily unavailable. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;

    try {
      await continueToDashboard();
    } catch {
      setErrorText("Unable to check your account access. Please try again.");
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  const pageTitle = mode === "register" ? "Create your Admin account" : "Welcome back";
  const pageSubtitle =
    mode === "forgot"
      ? "We’ll send a secure link to reset your password."
      : mode === "register"
        ? "Set up your BUS FLOW administrator account."
        : "Sign in to continue";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[0.92fr_1.08fr]">
        <section className="auth-art-panel relative hidden flex-col justify-between overflow-hidden px-10 py-10 lg:flex xl:px-16">
          <BrandLockup size="default" />
          <div className="relative z-10 mt-12">
            <p className="text-sm font-semibold uppercase text-primary">A better ride starts here</p>
            <h1 className="font-display mt-3 max-w-lg text-5xl font-semibold leading-tight text-foreground">
              Move every journey forward.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
              One clear view for the people and routes that keep your service moving.
            </p>
          </div>
          <div className="mt-6 flex flex-1 items-end justify-center">
            <img className="w-full max-w-xl" src={busSplash} alt="Blue intercity coach" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">Ride Smart. Travel Better.</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-7 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <BrandLockup />
              <span className="text-xs font-medium text-muted-foreground">Ride Smart</span>
            </div>

            <div className="mb-5 flex justify-center lg:hidden">
              <img className="h-24 w-full max-w-xs object-contain" src={busSplash} alt="Blue intercity coach" />
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-lg sm:p-7">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase text-primary">BUS FLOW</p>
                <h2 className="font-display mt-2 text-2xl font-semibold text-foreground">{pageTitle}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{pageSubtitle}</p>
              </div>

              {mode === "login" && (
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="login-email">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-email"
                        className="h-12 rounded-md bg-muted/50 pl-10"
                        type="email"
                        autoComplete="email"
                        maxLength={255}
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="login-password">
                      Password
                    </label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-password"
                        className="h-12 rounded-md bg-muted/50 pl-10 pr-12"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        maxLength={128}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        title={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 py-1">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        className="size-4 accent-primary"
                        type="checkbox"
                        checked={rememberEmail}
                        onChange={(event) => setRememberEmail(event.target.checked)}
                      />
                      Remember me
                    </label>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0 text-sm text-primary"
                      onClick={() => {
                        clearMessages();
                        setMode("forgot");
                      }}
                    >
                      Forgot password?
                    </Button>
                  </div>

                  <Button className="h-12 w-full rounded-md text-base" type="submit" disabled={busy}>
                    {busy ? <LoaderCircle className="animate-spin" /> : null}
                    Sign in
                  </Button>
                </form>
              )}

              {mode === "register" && (
                <form className="space-y-3.5" onSubmit={handleRegistration}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="register-name">
                      Full name
                    </label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-name"
                        className="h-11 rounded-md bg-muted/50 pl-10"
                        autoComplete="name"
                        maxLength={120}
                        required
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="register-email">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-email"
                        className="h-11 rounded-md bg-muted/50 pl-10"
                        type="email"
                        autoComplete="email"
                        maxLength={255}
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="register-phone">
                      Phone number
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-phone"
                        className="h-11 rounded-md bg-muted/50 pl-10"
                        type="tel"
                        autoComplete="tel"
                        maxLength={32}
                        required
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="register-password">
                      Password
                    </label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-password"
                        className="h-11 rounded-md bg-muted/50 pl-10"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="register-confirm">
                      Confirm password
                    </label>
                    <Input
                      id="register-confirm"
                      className="h-11 rounded-md bg-muted/50"
                      type="password"
                      autoComplete="new-password"
                      maxLength={128}
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your password"
                    />
                  </div>
                  <Button className="mt-2 h-12 w-full rounded-md text-base" type="submit" disabled={busy}>
                    {busy ? <LoaderCircle className="animate-spin" /> : null}
                    Create Admin Account
                  </Button>
                </form>
              )}

              {mode === "forgot" && (
                <form className="space-y-4" onSubmit={handleForgotPassword}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="forgot-email">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        className="h-12 rounded-md bg-muted/50 pl-10"
                        type="email"
                        autoComplete="email"
                        maxLength={255}
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <Button className="h-12 w-full rounded-md" type="submit" disabled={busy}>
                    {busy ? <LoaderCircle className="animate-spin" /> : null}
                    Send reset link
                  </Button>
                </form>
              )}

              {errorText ? (
                <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {errorText}
                </p>
              ) : null}
              {notice ? (
                <p className="mt-4 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground" role="status">
                  {notice}
                </p>
              ) : null}

              {mode === "login" && (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    <span>or continue with</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full border-google-border bg-google-background text-sm font-medium text-google-foreground hover:bg-google-hover hover:text-google-foreground"
                      disabled={busy}
                      onClick={() => void handleSocialSignIn("google")}
                    >
                      <GoogleLogo />
                      Continue with Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full"
                      disabled={busy}
                      onClick={() => void handleSocialSignIn("lovable")}
                    >
                      <LovableMark className="size-[18px]" />
                      Continue with Lovable
                    </Button>
                  </div>
                </>
              )}

              <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    Don’t have an account?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-1 font-semibold text-primary"
                      onClick={() => {
                        clearMessages();
                        setMode("register");
                      }}
                    >
                      Create Account
                    </Button>
                  </>
                ) : mode === "register" ? (
                  <>
                    Already have an account?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-1 font-semibold text-primary"
                      onClick={() => {
                        clearMessages();
                        setMode("login");
                      }}
                    >
                      Login
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-1 font-semibold text-primary"
                    onClick={() => {
                      clearMessages();
                      setMode("login");
                    }}
                  >
                    Back to login
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">Ride Smart. Travel Better.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}