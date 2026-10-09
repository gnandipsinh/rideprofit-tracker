import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, LogOut, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { useSaveSettings } from "@/lib/queries";
import { sanitizeEmail } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

const CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee (₹)" },
  { value: "USD", label: "USD — US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — Pound (£)" },
  { value: "AED", label: "AED — Dirham" },
];

const NO_DEFAULT = "none";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Jay Mataji Transport" },
      {
        name: "description",
        content:
          "Manage your profile, change your password and configure your transport business details.",
      },
      { property: "og:title", content: "Settings — Jay Mataji Transport" },
      {
        property: "og:description",
        content: "Manage your profile, change your password and business details.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, activeVehicles } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useSaveSettings();

  const [appName, setAppName] = useState("");
  const [transportationName, setTransportationName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [defaultVehicleId, setDefaultVehicleId] = useState(NO_DEFAULT);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || hydrated) return;
    setAppName(settings.appName || "");
    setTransportationName(settings.transportationName || "");
    setCurrency(settings.currency || "INR");
    setDefaultVehicleId(settings.defaultVehicleId || NO_DEFAULT);
    setFullName(settings.fullName || "");
    setMobileNumber(settings.mobileNumber || "");
    setBusinessName(settings.businessName || "");
    setAddress(settings.address || "");
    setContactNumber(settings.contactNumber || "");
    setBusinessEmail(settings.businessEmail || "");
    setHydrated(true);
  }, [settings, hydrated]);

  useEffect(() => {
    void supabase.auth.getUser().then((res: { data: { user: { email?: string } | null } }) => {
      setEmail(res.data.user?.email ?? "");
    });
  }, []);

  const submit = () => {
    const transport = transportationName.trim();
    const app = appName.trim() || transport || "Vehicle Calculation System";
    if (!transport && !app) {
      toast.error("Transportation name is required");
      return;
    }
    const payload = {
      appName: app,
      transportationName: transport || app,
      currency,
      defaultVehicleId: defaultVehicleId === NO_DEFAULT ? null : defaultVehicleId,
      fullName: fullName.trim(),
      mobileNumber: mobileNumber.trim(),
      businessName: businessName.trim(),
      address: address.trim(),
      contactNumber: contactNumber.trim(),
      businessEmail: sanitizeEmail(businessEmail),
    };
    setAppName(payload.appName);
    setTransportationName(payload.transportationName);
    save.mutate(payload, {
      onSuccess: (saved) => {
        setAppName(saved.appName || payload.appName);
        setTransportationName(saved.transportationName || payload.transportationName);
        setFullName(saved.fullName || payload.fullName);
        setMobileNumber(saved.mobileNumber || payload.mobileNumber);
        setBusinessName(saved.businessName || payload.businessName);
        setAddress(saved.address || payload.address);
        setContactNumber(saved.contactNumber || payload.contactNumber);
        setBusinessEmail(saved.businessEmail || payload.businessEmail);
        setCurrency(saved.currency || payload.currency);
        setDefaultVehicleId(saved.defaultVehicleId || payload.defaultVehicleId || NO_DEFAULT);
        setHydrated(true);
      },
    });
  };

  const changePassword = async () => {
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmNewPassword) {
      toast.error("Enter a valid new password and confirm it");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("New password must include at least one letter and one number");
      return;
    }
    setPasswordBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const userEmail = data.user?.email;
      if (!userEmail) {
        toast.error("Could not verify user");
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (authError) {
        toast.error("Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) toast.error("Could not change password");
      else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        toast.success("Password changed");
      }
    } catch {
      toast.error("Could not change password");
    } finally {
      setPasswordBusy(false);
    }
  };

  const logout = async () => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("vcs.selectedVehicleId");
        window.localStorage.removeItem("SELECTED_KEY");
      }
      navigate({ to: "/auth", replace: true });
    } catch {
      navigate({ to: "/auth", replace: true });
    }
  };

  return (
    <AppShell showAddTrip={false}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold sm:text-2xl">Settings</h2>
              <p className="text-xs text-muted-foreground">
                Manage your profile, security and business details
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass-card rounded-2xl p-4 sm:p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary text-[0.6rem]">
                1
              </span>
              Profile
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="fullName"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  value={email}
                  readOnly
                  className="h-12 rounded-xl bg-secondary/60 text-base text-muted-foreground"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label
                  htmlFor="mobileNumber"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Mobile Number
                </Label>
                <Input
                  id="mobileNumber"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                />
              </div>
            </div>
          </section>

          <section className="glass-card rounded-2xl p-4 sm:p-5 lg:order-3 lg:col-span-2">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary text-[0.6rem]">
                2
              </span>
              Transport / Business Profile
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label
                  htmlFor="appName"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  App Name
                </Label>
                <Input
                  id="appName"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                  placeholder="Vehicle Calculation System"
                />
                <p className="text-[0.7rem] text-muted-foreground">
                  Shown in the header when no transportation name is set.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label
                  htmlFor="transportationName"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Transportation / Company Name
                </Label>
                <Input
                  id="transportationName"
                  value={transportationName}
                  onChange={(e) => setTransportationName(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                  placeholder="ABC TRANSPORT"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="businessName"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="businessEmail"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Business Email
                </Label>
                <Input
                  id="businessEmail"
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label
                  htmlFor="address"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Address
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="contactNumber"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Contact Number
                </Label>
                <Input
                  id="contactNumber"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="h-12 rounded-xl bg-secondary/60 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Currency
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/60 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Default Vehicle
                </Label>
                <Select value={defaultVehicleId} onValueChange={setDefaultVehicleId}>
                  <SelectTrigger className="h-12 rounded-xl bg-secondary/60 text-base">
                    <SelectValue placeholder="No default" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={NO_DEFAULT}>No default</SelectItem>
                    {activeVehicles.map((v) => (
                      <SelectItem key={v._id} value={v._id}>
                        {v.type || v.name}
                        {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="glass-card rounded-2xl p-4 sm:p-5 lg:order-2">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary text-[0.6rem]">
                3
              </span>
              Security
            </h3>
            <div className="space-y-4">
              {[
                {
                  id: "currentPassword",
                  label: "Current Password",
                  value: currentPassword,
                  setter: setCurrentPassword,
                },
                {
                  id: "newPassword",
                  label: "New Password",
                  value: newPassword,
                  setter: setNewPassword,
                },
                {
                  id: "confirmNewPassword",
                  label: "Confirm New Password",
                  value: confirmNewPassword,
                  setter: setConfirmNewPassword,
                },
              ].map(({ id, label, value, setter }) => (
                <div key={id} className="space-y-2">
                  <Label
                    htmlFor={id}
                    className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={id}
                      type={showPasswords ? "text" : "password"}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="h-12 rounded-xl bg-secondary/60 text-base pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPasswords ? "Hide password" : "Show password"}
                      onClick={() => setShowPasswords((shown) => !shown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                <Button
                  onClick={changePassword}
                  disabled={passwordBusy || save.isPending}
                  className="h-12 w-full rounded-xl font-semibold"
                >
                  {passwordBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Change Password
                </Button>
                <Button
                  onClick={submit}
                  disabled={save.isPending}
                  className="h-12 w-full rounded-xl text-base font-semibold"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {save.isPending ? "Saving…" : "Save settings"}
                </Button>
                <Button
                  variant="outline"
                  onClick={logout}
                  className="h-11 w-full rounded-xl sm:col-span-2"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
