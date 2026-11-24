import { useState } from "react";
import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  BusFront,
  CalendarCheck,
  ChartNoAxesCombined,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  FileChartColumnIncreasing,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Trash2,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { z } from "zod";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createConductorAccount,
  deleteConductorAccount,
  getAdminWorkspace,
  resetConductorPassword,
  updateConductorAccount,
} from "@/lib/admin.functions";
import type { StaffRecord } from "@/lib/admin.functions";
import {
  createConductorSchema,
  deleteConductorSchema,
  resetConductorPasswordSchema,
  updateConductorSchema,
} from "@/lib/auth-schemas";
import { supabase } from "@/integrations/supabase/client";
import { getSignedInAccess } from "@/lib/auth-client";
import { canAccessDashboard, homeForRoles } from "@/lib/role-access";
import { signOutAndClear } from "@/lib/session-actions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard | BUS FLOW" },
      { name: "description", content: "Manage BUS FLOW staff, routes, and daily operations." },
      { property: "og:title", content: "Admin dashboard | BUS FLOW" },
      { property: "og:description", content: "Manage BUS FLOW staff, routes, and daily operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const access = await getSignedInAccess();
    if (!access) throw redirect({ to: "/auth" });
    if (!canAccessDashboard(access.roles, "admin", access.isActive)) {
      throw redirect({ to: homeForRoles(access.roles, access.isActive) });
    }
    return { access };
  },
  loader: () => getAdminWorkspace(),
  component: AdminDashboard,
});

type StaffForm = {
  fullName: string;
  email: string;
  phone: string;
  initialPassword: string;
  assignedBus: string;
  assignedRoute: string;
  isActive: boolean;
};

const emptyStaffForm: StaffForm = {
  fullName: "",
  email: "",
  phone: "",
  initialPassword: "",
  assignedBus: "",
  assignedRoute: "",
  isActive: true,
};

function AdminDashboard() {
  const workspace = Route.useLoaderData();
  const { access } = Route.useRouteContext();
  const navigate = useNavigate({ from: "/admin" });
  const router = useRouter();
  const queryClient = useQueryClient();
  const createConductor = useServerFn(createConductorAccount);
  const updateConductor = useServerFn(updateConductorAccount);
  const resetPassword = useServerFn(resetConductorPassword);
  const deleteConductor = useServerFn(deleteConductorAccount);
  const [dialog, setDialog] = useState<"create" | "edit" | "reset" | "delete" | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyStaffForm);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dialogError, setDialogError] = useState("");

  const filteredStaff = workspace.staff.filter((member) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [member.fullName, member.email, member.assignedBus, member.assignedRoute]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  function setField<Key extends keyof StaffForm>(key: Key, value: StaffForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreateDialog() {
    setSelectedStaff(null);
    setForm(emptyStaffForm);
    setDialogError("");
    setDialog("create");
  }

  function openEditDialog(member: StaffRecord) {
    setSelectedStaff(member);
    setForm({
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      initialPassword: "",
      assignedBus: member.assignedBus,
      assignedRoute: member.assignedRoute,
      isActive: member.isActive,
    });
    setDialogError("");
    setDialog("edit");
  }

  async function refreshWorkspace(successMessage: string) {
    setDialog(null);
    setDialogError("");
    setFeedback(successMessage);
    await router.invalidate();
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDialogError("");
    const parsed = createConductorSchema.safeParse(form);
    if (!parsed.success) {
      setDialogError(parsed.error.issues[0]?.message ?? "Check the conductor details.");
      return;
    }

    setBusy(true);
    try {
      await createConductor({ data: parsed.data });
      setForm(emptyStaffForm);
      await refreshWorkspace("Conductor account created.");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The account could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStaff) return;
    setDialogError("");
    const parsed = updateConductorSchema.safeParse({ ...form, id: selectedStaff.id });
    if (!parsed.success) {
      setDialogError(parsed.error.issues[0]?.message ?? "Check the conductor details.");
      return;
    }

    setBusy(true);
    try {
      await updateConductor({ data: parsed.data });
      await refreshWorkspace("Conductor details updated.");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStaff) return;
    const parsed = resetConductorPasswordSchema.safeParse({
      id: selectedStaff.id,
      password: newPassword,
      confirmPassword: confirmNewPassword,
    });
    if (!parsed.success) {
      setDialogError(parsed.error.issues[0]?.message ?? "Check the new password.");
      return;
    }

    setBusy(true);
    try {
      await resetPassword({ data: parsed.data });
      setNewPassword("");
      setConfirmNewPassword("");
      await refreshWorkspace("Conductor password reset.");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The password could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selectedStaff) return;
    const parsed = deleteConductorSchema.safeParse({ id: selectedStaff.id });
    if (!parsed.success) {
      setDialogError("This conductor account could not be identified.");
      return;
    }

    setBusy(true);
    try {
      await deleteConductor({ data: parsed.data });
      setSelectedStaff(null);
      await refreshWorkspace("Conductor account deleted.");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The account could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOutAndClear(queryClient);
      await navigate({ to: "/auth", replace: true });
    } catch {
      setFeedback("You could not be signed out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const statCards = [
    { label: "Total Buses", value: workspace.stats.totalBuses, icon: BusFront, tone: "bg-primary/10 text-primary" },
    { label: "Active Routes", value: workspace.stats.activeRoutes, icon: MapPin, tone: "bg-chart-2/15 text-chart-2" },
    { label: "Total Conductors", value: workspace.stats.totalConductors, icon: UsersRound, tone: "bg-chart-4/15 text-chart-4" },
    { label: "Today’s Bookings", value: workspace.stats.todaysBookings, icon: CalendarCheck, tone: "bg-chart-3/15 text-chart-3" },
  ];

  const quickAccess = [
    { label: "Users & Staff", icon: UsersRound, active: true, target: "staff" },
    { label: "Bus Owners", icon: CircleUserRound, active: false, target: "" },
    { label: "Manage Buses", icon: BusFront, active: false, target: "" },
    { label: "Manage Routes", icon: MapPin, active: false, target: "" },
    { label: "Conductors", icon: Activity, active: true, target: "staff" },
    { label: "Bookings", icon: Ticket, active: false, target: "" },
    { label: "Passengers", icon: UsersRound, active: false, target: "" },
    { label: "Reports & Analytics", icon: FileChartColumnIncreasing, active: false, target: "" },
    { label: "Notifications", icon: Bell, active: false, target: "" },
    { label: "Settings", icon: Settings, active: false, target: "" },
  ];

  return (
    <main className="min-h-screen bg-background pb-10">
      <header className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:px-7 lg:px-10">
          <div className="min-w-0">
            <BrandLockup />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Notifications" title="Notifications" disabled>
              <Bell />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Sign out ${access.fullName || "Admin"}`}
              title="Sign out"
              disabled={busy}
              onClick={() => void handleSignOut()}
            >
              <CircleUserRound />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
        <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">Operations overview</p>
            <h1 className="font-display mt-1 truncate text-2xl font-semibold sm:text-3xl">Hello, Admin</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">{workspace.adminName}</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground sm:flex">
            <ShieldCheck className="size-4" />
            Administrator
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Dashboard summary">
          {statCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="rounded-lg border-border/80 p-3 shadow-sm sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-md ${item.tone}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="font-display text-2xl font-semibold sm:text-3xl">{item.value}</span>
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground sm:text-sm">{item.label}</p>
              </Card>
            );
          })}
        </section>

        <section className="mt-8" aria-labelledby="quick-access-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="quick-access-title" className="font-display text-lg font-semibold">Quick Access</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your operations, one tap away.</p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">Phase 1</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {quickAccess.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.label}
                  type="button"
                  variant="outline"
                  disabled={!item.active}
                  onClick={() => {
                    if (item.target) document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-auto min-h-20 justify-start gap-3 rounded-lg border-border/80 px-3 py-3 text-left shadow-sm"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold leading-4 text-foreground sm:text-sm">{item.label}</span>
                    {!item.active ? <span className="mt-1 block text-[11px] text-muted-foreground">Next phase</span> : null}
                  </span>
                  {item.active ? <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" /> : null}
                </Button>
              );
            })}
          </div>
        </section>

        <section id="staff" className="mt-9 scroll-mt-6" aria-labelledby="staff-title">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">People and access</p>
              <h2 id="staff-title" className="font-display mt-1 text-xl font-semibold">Users &amp; Staff</h2>
              <p className="mt-1 text-sm text-muted-foreground">Create and manage conductor accounts.</p>
            </div>
            <Button className="shrink-0 rounded-md" onClick={openCreateDialog}>
              <Plus />
              <span className="hidden sm:inline">Add conductor</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>

          {feedback ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground" role="status">
              <span>{feedback}</span>
              <Button variant="ghost" size="icon" aria-label="Dismiss message" onClick={() => setFeedback("")}>
                <X />
              </Button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-md bg-card pl-9"
                type="search"
                maxLength={120}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a staff member"
                aria-label="Search staff"
              />
            </div>
            <div className="text-xs text-muted-foreground">{workspace.stats.totalConductors} conductor accounts</div>
          </div>

          {filteredStaff.length ? (
            <div className="divide-y divide-border">
              {filteredStaff.map((member) => (
                <article key={member.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                      <CircleUserRound className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{member.fullName}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${member.isActive ? "bg-chart-2/15 text-chart-2" : "bg-muted text-muted-foreground"}`}>
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{member.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {member.assignedBus || "No bus assigned"} <span aria-hidden="true">·</span> {member.assignedRoute || "No route assigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${member.fullName}`} title="Edit staff" onClick={() => openEditDialog(member)}>
                      <ClipboardList />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Reset password for ${member.fullName}`}
                      title="Reset password"
                      onClick={() => {
                        setSelectedStaff(member);
                        setNewPassword("");
                        setConfirmNewPassword("");
                        setDialogError("");
                        setDialog("reset");
                      }}
                    >
                      <LockKeyhole />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${member.fullName}`}
                      title="Delete account"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedStaff(member);
                        setDialogError("");
                        setDialog("delete");
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-secondary text-primary">
                <UsersRound className="size-6" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{search ? "No matching staff" : "No conductors yet"}</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {search ? "Try another name, email, bus, or route." : "Add your first conductor to start organizing the team."}
              </p>
              {!search ? (
                <Button className="mt-4" variant="outline" onClick={openCreateDialog}>
                  <Plus />
                  Add conductor
                </Button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg sm:max-w-lg">
          {dialog === "create" || dialog === "edit" ? (
            <>
              <DialogHeader>
                <DialogTitle>{dialog === "create" ? "Add a conductor" : "Edit conductor"}</DialogTitle>
                <DialogDescription>
                  {dialog === "create" ? "Create a staff login and set its first assignments." : "Update staff details, assignments, or account status."}
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-3" onSubmit={dialog === "create" ? handleCreate : handleUpdate}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Full name" id="staff-name">
                    <Input id="staff-name" maxLength={120} required value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} />
                  </FormField>
                  <FormField label="Email address" id="staff-email">
                    <Input id="staff-email" type="email" autoComplete="email" maxLength={255} required value={form.email} onChange={(event) => setField("email", event.target.value)} />
                  </FormField>
                  <FormField label="Phone number" id="staff-phone">
                    <Input id="staff-phone" type="tel" autoComplete="tel" maxLength={32} required value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
                  </FormField>
                  {dialog === "create" ? (
                    <FormField label="Initial password" id="staff-password">
                      <Input id="staff-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={form.initialPassword} onChange={(event) => setField("initialPassword", event.target.value)} />
                    </FormField>
                  ) : null}
                  <FormField label="Assign bus" id="staff-bus">
                    <Input id="staff-bus" maxLength={80} value={form.assignedBus} onChange={(event) => setField("assignedBus", event.target.value)} placeholder="e.g. KL 15 A 7286" />
                  </FormField>
                  <FormField label="Assign route" id="staff-route">
                    <Input id="staff-route" maxLength={120} value={form.assignedRoute} onChange={(event) => setField("assignedRoute", event.target.value)} placeholder="e.g. Calicut → Kozhikode" />
                  </FormField>
                </div>
                {dialog === "edit" ? (
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">Account active</p>
                      <p className="text-xs text-muted-foreground">Inactive staff cannot sign in.</p>
                    </div>
                    <Switch checked={form.isActive} onCheckedChange={(checked) => setField("isActive", checked)} aria-label="Account active" />
                  </div>
                ) : null}
                {dialogError ? <p className="text-sm text-destructive" role="alert">{dialogError}</p> : null}
                <DialogFooter className="gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving..." : dialog === "create" ? "Create conductor account" : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}

          {dialog === "reset" ? (
            <>
              <DialogHeader>
                <DialogTitle>Reset conductor password</DialogTitle>
                <DialogDescription>Set a new password for {selectedStaff?.fullName ?? "this conductor"}.</DialogDescription>
              </DialogHeader>
              <form className="space-y-3" onSubmit={handleResetPassword}>
                <FormField label="New password" id="reset-staff-password">
                  <Input id="reset-staff-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                </FormField>
                <FormField label="Confirm new password" id="reset-staff-confirm">
                  <Input id="reset-staff-confirm" type="password" autoComplete="new-password" maxLength={128} required value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} />
                </FormField>
                {dialogError ? <p className="text-sm text-destructive" role="alert">{dialogError}</p> : null}
                <DialogFooter className="gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                  <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Reset password"}</Button>
                </DialogFooter>
              </form>
            </>
          ) : null}

          {dialog === "delete" ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete conductor account?</DialogTitle>
                <DialogDescription>
                  {selectedStaff?.fullName ?? "This conductor"} will no longer be able to sign in. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              {dialogError ? <p className="text-sm text-destructive" role="alert">{dialogError}</p> : null}
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialog(null)}>Keep account</Button>
                <Button variant="destructive" disabled={busy} onClick={() => void handleDelete()}>
                  {busy ? "Deleting..." : "Delete account"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FormField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-medium" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}